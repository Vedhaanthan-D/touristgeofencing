// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TouristRegistry {
    struct Tourist {
        string dtid;
        string aadhaarHash;
        string tripHash;
        uint256 issuedAt;
        uint256 returnDate;
        bool isActive;
    }

    mapping(string => Tourist) public tourists;

    function registerTourist(
        string memory dtid,
        string memory aadhaarHash,
        string memory tripHash,
        uint256 returnDate
    ) public {
        tourists[dtid] = Tourist(dtid, aadhaarHash, tripHash, block.timestamp, returnDate, true);
    }

    function getTourist(string memory dtid) public view returns (Tourist memory) {
        return tourists[dtid];
    }

    function checkAndUpdateStatus(string memory dtid) public {
        Tourist storage tourist = tourists[dtid];
        if (block.timestamp > tourist.returnDate) {
            tourist.isActive = false;
        }
    }

    function isActiveTourist(string memory dtid) public view returns (bool) {
        Tourist memory tourist = tourists[dtid];
        return tourist.isActive && block.timestamp <= tourist.returnDate;
    }
}
