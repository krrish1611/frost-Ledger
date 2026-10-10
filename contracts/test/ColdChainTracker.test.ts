import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ColdChainTracker } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('ColdChainTracker Solidity Smart Contract', () => {
  let tracker: ColdChainTracker;
  let owner: HardhatEthersSigner;
  let authorizedSubmitter: HardhatEthersSigner;
  let unauthorizedAccount: HardhatEthersSigner;

  const sampleShipmentId = 'shipment-contract-test-001';
  const sampleProfileHash = ethers.keccak256(ethers.toUtf8Bytes('sample-profile-parameters'));
  const tempMinMilliC = 2000; // 2.0 C
  const tempMaxMilliC = 8000; // 8.0 C

  beforeEach(async () => {
    [owner, authorizedSubmitter, unauthorizedAccount] = await ethers.getSigners();

    const ColdChainTrackerFactory = await ethers.getContractFactory('ColdChainTracker');
    tracker = await ColdChainTrackerFactory.deploy();
    await tracker.waitForDeployment();

    // Authorize submitter
    await tracker.connect(owner).setSubmitter(authorizedSubmitter.address, true);
  });

  // Acceptance Check 1: Access Control (non-authorized account cannot write)
  describe('Access Control', () => {
    it('Owner can authorize submitters, non-owner cannot', async () => {
      await expect(
        tracker.connect(unauthorizedAccount).setSubmitter(unauthorizedAccount.address, true)
      ).to.be.revertedWith('Only contract owner');

      expect(await tracker.authorizedSubmitters(authorizedSubmitter.address)).to.be.true;
      expect(await tracker.authorizedSubmitters(unauthorizedAccount.address)).to.be.false;
    });

    it('Non-authorized account cannot register a shipment (reverts)', async () => {
      await expect(
        tracker
          .connect(unauthorizedAccount)
          .registerShipment(sampleShipmentId, sampleProfileHash, tempMinMilliC, tempMaxMilliC)
      ).to.be.revertedWith('Not authorized to submit');
    });

    it('Non-authorized account cannot anchor a batch window (reverts)', async () => {
      // Register shipment via authorized submitter first
      await tracker
        .connect(authorizedSubmitter)
        .registerShipment(sampleShipmentId, sampleProfileHash, tempMinMilliC, tempMaxMilliC);

      const sampleWindowHash = ethers.keccak256(ethers.toUtf8Bytes('window-1-hashes'));

      await expect(
        tracker
          .connect(unauthorizedAccount)
          .anchorBatchWindow(sampleShipmentId, sampleWindowHash, 1, 10)
      ).to.be.revertedWith('Not authorized to submit');
    });
  });

  // Acceptance Check 2: Snapshot Immutability
  describe('Snapshot Immutability', () => {
    it('Registration succeeds, but subsequent registration for same shipment reverts', async () => {
      await expect(
        tracker
          .connect(authorizedSubmitter)
          .registerShipment(sampleShipmentId, sampleProfileHash, tempMinMilliC, tempMaxMilliC)
      )
        .to.emit(tracker, 'ShipmentRegistered')
        .withArgs(sampleShipmentId, sampleProfileHash);

      // Attempt to overwrite or mutate registration must revert
      await expect(
        tracker
          .connect(authorizedSubmitter)
          .registerShipment(sampleShipmentId, sampleProfileHash, 0, 10000)
      ).to.be.revertedWith('Shipment already registered');

      // Verify stored snapshot is identical
      const profile = await tracker.getShipmentProfile(sampleShipmentId);
      expect(profile.profileHash).to.equal(sampleProfileHash);
      expect(profile.tempMinMilliC).to.equal(BigInt(tempMinMilliC));
      expect(profile.tempMaxMilliC).to.equal(BigInt(tempMaxMilliC));
    });
  });

  // Acceptance Check 3: Duplicate Submission & Sequence Continuity
  describe('Batch Window Anchoring & Sequence Checks', () => {
    beforeEach(async () => {
      await tracker
        .connect(authorizedSubmitter)
        .registerShipment(sampleShipmentId, sampleProfileHash, tempMinMilliC, tempMaxMilliC);
    });

    it('Anchors initial window starting at sequence 1', async () => {
      const windowHash = ethers.keccak256(ethers.toUtf8Bytes('window-batch-1-to-5'));
      await expect(
        tracker.connect(authorizedSubmitter).anchorBatchWindow(sampleShipmentId, windowHash, 1, 5)
      )
        .to.emit(tracker, 'WindowAnchored')
        .withArgs(sampleShipmentId, windowHash, 1n, 5n);

      expect(await tracker.getWindowsCount(sampleShipmentId)).to.equal(1n);

      const record = await tracker.getWindow(sampleShipmentId, 0);
      expect(record.windowHash).to.equal(windowHash);
      expect(record.startSeq).to.equal(1n);
      expect(record.endSeq).to.equal(5n);
    });

    it('Rejects initial window that does not start at sequence 1', async () => {
      const windowHash = ethers.keccak256(ethers.toUtf8Bytes('window-batch-5-to-10'));
      await expect(
        tracker.connect(authorizedSubmitter).anchorBatchWindow(sampleShipmentId, windowHash, 5, 10)
      ).to.be.revertedWith('Initial window must start at sequence 1');
    });

    it('Rejects duplicate or overlapping window sequence range', async () => {
      const w1 = ethers.keccak256(ethers.toUtf8Bytes('window-1'));
      await tracker.connect(authorizedSubmitter).anchorBatchWindow(sampleShipmentId, w1, 1, 5);

      // Attempt to submit overlapping window (e.g. sequence 4 to 8)
      const wOverlap = ethers.keccak256(ethers.toUtf8Bytes('window-overlap'));
      await expect(
        tracker.connect(authorizedSubmitter).anchorBatchWindow(sampleShipmentId, wOverlap, 4, 8)
      ).to.be.revertedWith('Window sequence gap or overlap');

      // Attempt to submit sequence gap (e.g. sequence 8 to 10 when last was 5)
      await expect(
        tracker.connect(authorizedSubmitter).anchorBatchWindow(sampleShipmentId, wOverlap, 8, 10)
      ).to.be.revertedWith('Window sequence gap or overlap');

      // Continuous window 6 to 10 succeeds
      const w2 = ethers.keccak256(ethers.toUtf8Bytes('window-2'));
      await expect(
        tracker.connect(authorizedSubmitter).anchorBatchWindow(sampleShipmentId, w2, 6, 10)
      ).to.emit(tracker, 'WindowAnchored');

      expect(await tracker.getWindowsCount(sampleShipmentId)).to.equal(2n);
    });

    it('Validates on-chain threshold checker against snapshot limits', async () => {
      // 5.0 C (5000 milliC) is in range [2000, 8000]
      expect(await tracker.checkOnChainThresholds(sampleShipmentId, 5000)).to.be.true;

      // 12.0 C (12000 milliC) is out of range
      expect(await tracker.checkOnChainThresholds(sampleShipmentId, 12000)).to.be.false;

      // 1.0 C (1000 milliC) is below range
      expect(await tracker.checkOnChainThresholds(sampleShipmentId, 1000)).to.be.false;
    });
  });
});
