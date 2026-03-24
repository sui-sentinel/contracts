// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Sentinel.sol";

contract DeploySentinel is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address protocolWallet = vm.envAddress("PROTOCOL_WALLET");

        vm.startBroadcast(deployerPrivateKey);

        Sentinel sentinel = new Sentinel(protocolWallet);

        console.log("Sentinel deployed at:", address(sentinel));

        vm.stopBroadcast();
    }
}

contract SetupSentinel is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sentinelAddress = vm.envAddress("SENTINEL_ADDRESS");
        address enclavePublicKey = vm.envAddress("ENCLAVE_PUBLIC_KEY");

        Sentinel sentinel = Sentinel(sentinelAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Register enclave
        sentinel.registerEnclave(enclavePublicKey);
        console.log("Enclave registered:", enclavePublicKey);

        vm.stopBroadcast();
    }
}

contract WhitelistToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address sentinelAddress = vm.envAddress("SENTINEL_ADDRESS");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        uint256 minimumAmount = vm.envOr("MINIMUM_AMOUNT", uint256(0));

        Sentinel sentinel = Sentinel(sentinelAddress);

        vm.startBroadcast(deployerPrivateKey);

        sentinel.addWhitelistedToken(tokenAddress);
        console.log("Token whitelisted:", tokenAddress);

        if (minimumAmount > 0) {
            sentinel.setMinimumTokenAmount(tokenAddress, minimumAmount);
            console.log("Minimum amount set:", minimumAmount);
        }

        vm.stopBroadcast();
    }
}
