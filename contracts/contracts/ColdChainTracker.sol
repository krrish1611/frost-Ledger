// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ColdChainTracker
 * @notice Stores batch window hashes and frozen profile snapshots per shipment on-chain.
 */
contract ColdChainTracker {
    address public owner;
    mapping(address => bool) public authorizedSubmitters;

    struct ProfileSnapshot {
        bytes32 profileHash;
        int256 tempMinMilliC; // Temperature in milli-Celsius (e.g., 2000 for 2.0 C)
        int256 tempMaxMilliC;
        uint256 registeredAt;
    }

    struct WindowRecord {
        bytes32 windowHash;
        uint256 startSeq;
        uint256 endSeq;
        uint256 timestamp;
    }

    // shipmentId => ProfileSnapshot
    mapping(string => ProfileSnapshot) public shipmentProfiles;
    // shipmentId => array of WindowRecords
    mapping(string => WindowRecord[]) internal shipmentWindows;

    event SubmitterUpdated(address indexed submitter, bool authorized);
    event ShipmentRegistered(string indexed shipmentId, bytes32 indexed profileHash);
    event WindowAnchored(string indexed shipmentId, bytes32 indexed windowHash, uint256 startSeq, uint256 endSeq);

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedSubmitters[msg.sender], "Not authorized to submit");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedSubmitters[msg.sender] = true;
    }

    function setSubmitter(address submitter, bool authorized) external onlyOwner {
        authorizedSubmitters[submitter] = authorized;
        emit SubmitterUpdated(submitter, authorized);
    }

    function registerShipment(
        string calldata shipmentId,
        bytes32 profileHash,
        int256 tempMinMilliC,
        int256 tempMaxMilliC
    ) external onlyAuthorized {
        require(shipmentProfiles[shipmentId].registeredAt == 0, "Shipment already registered");
        require(profileHash != bytes32(0), "Invalid profile hash");
        require(tempMaxMilliC >= tempMinMilliC, "Invalid temperature range");

        shipmentProfiles[shipmentId] = ProfileSnapshot({
            profileHash: profileHash,
            tempMinMilliC: tempMinMilliC,
            tempMaxMilliC: tempMaxMilliC,
            registeredAt: block.timestamp
        });
        emit ShipmentRegistered(shipmentId, profileHash);
    }

    function anchorBatchWindow(
        string calldata shipmentId,
        bytes32 windowHash,
        uint256 startSeq,
        uint256 endSeq
    ) external onlyAuthorized {
        require(shipmentProfiles[shipmentId].registeredAt > 0, "Shipment not registered");
        require(endSeq >= startSeq, "Invalid sequence range");
        require(windowHash != bytes32(0), "Invalid window hash");

        uint256 len = shipmentWindows[shipmentId].length;
        if (len > 0) {
            uint256 lastEndSeq = shipmentWindows[shipmentId][len - 1].endSeq;
            require(startSeq == lastEndSeq + 1, "Window sequence gap or overlap");
        } else {
            require(startSeq == 1, "Initial window must start at sequence 1");
        }

        shipmentWindows[shipmentId].push(WindowRecord({
            windowHash: windowHash,
            startSeq: startSeq,
            endSeq: endSeq,
            timestamp: block.timestamp
        }));

        emit WindowAnchored(shipmentId, windowHash, startSeq, endSeq);
    }

    function checkOnChainThresholds(string calldata shipmentId, int256 tempMilliC) external view returns (bool inRange) {
        require(shipmentProfiles[shipmentId].registeredAt > 0, "Shipment not registered");
        ProfileSnapshot memory p = shipmentProfiles[shipmentId];
        return (tempMilliC >= p.tempMinMilliC && tempMilliC <= p.tempMaxMilliC);
    }

    function getWindowsCount(string calldata shipmentId) external view returns (uint256) {
        return shipmentWindows[shipmentId].length;
    }

    function getWindow(string calldata shipmentId, uint256 index) external view returns (
        bytes32 windowHash,
        uint256 startSeq,
        uint256 endSeq,
        uint256 timestamp
    ) {
        require(index < shipmentWindows[shipmentId].length, "Index out of bounds");
        WindowRecord storage r = shipmentWindows[shipmentId][index];
        return (r.windowHash, r.startSeq, r.endSeq, r.timestamp);
    }

    function getShipmentProfile(string calldata shipmentId) external view returns (
        bytes32 profileHash,
        int256 tempMinMilliC,
        int256 tempMaxMilliC,
        uint256 registeredAt
    ) {
        ProfileSnapshot memory p = shipmentProfiles[shipmentId];
        return (p.profileHash, p.tempMinMilliC, p.tempMaxMilliC, p.registeredAt);
    }
}
