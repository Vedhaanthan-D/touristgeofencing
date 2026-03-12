const { ethers } = require('ethers');

/**
 * Blockchain Service for TouristRegistry Smart Contract
 * Handles all blockchain interactions with Polygon Amoy Testnet
 */
class BlockchainService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = process.env.CONTRACT_ADDRESS;
        this.isInitialized = false;

        // Smart Contract ABI
        this.abi = [
            'function registerTourist(string dtid, string aadhaarHash, string tripHash, uint256 returnDate) public',
            'function getTourist(string dtid) public view returns (tuple(string dtid, string aadhaarHash, string tripHash, uint256 issuedAt, uint256 returnDate, bool isActive))',
            'function checkAndUpdateStatus(string dtid) public',
            'function isActiveTourist(string dtid) public view returns (bool)',
        ];
    }

    /**
     * Initialize blockchain connection
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                return;
            }

            // Validate required environment variables
            if (!process.env.CONTRACT_ADDRESS) {
                throw new Error('CONTRACT_ADDRESS is not set in environment variables');
            }

            const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
            console.log('🔗 Connecting to blockchain:', rpcUrl);

            // Create provider
            this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);

            // Test connection
            const network = await this.provider.getNetwork();
            console.log('✅ Connected to network:', network.name, '(Chain ID:', network.chainId + ')');

            // Create signer
            if (process.env.USE_PROVIDER_SIGNER === 'true' || /localhost|127\.0\.0\.1/.test(rpcUrl)) {
                // Use local node signer (for development with Ganache/Hardhat)
                this.signer = this.provider.getSigner(0);
                console.log('🔑 Using provider signer (local development)');
            } else {
                // Use private key from environment
                if (!process.env.PRIVATE_KEY) {
                    throw new Error('PRIVATE_KEY is required when not using provider signer');
                }
                
                // Remove 0x prefix if present
                const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
                    ? process.env.PRIVATE_KEY 
                    : '0x' + process.env.PRIVATE_KEY;
                
                this.signer = new ethers.Wallet(privateKey, this.provider);
                const signerAddress = await this.signer.getAddress();
                console.log('🔑 Using wallet:', signerAddress);

                // Check wallet balance
                const balance = await this.provider.getBalance(signerAddress);
                console.log('💰 Wallet balance:', ethers.utils.formatEther(balance), 'MATIC');

                if (balance.isZero()) {
                    console.warn('⚠️  WARNING: Wallet has zero balance. Get test MATIC from https://faucet.polygon.technology/');
                }
            }

            // Create contract instance
            this.contract = new ethers.Contract(
                this.contractAddress,
                this.abi,
                this.signer
            );

            console.log('📜 Contract connected at:', this.contractAddress);
            this.isInitialized = true;

        } catch (error) {
            console.error('❌ Blockchain initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Register a tourist on the blockchain
     * @param {string} dtid - Digital Tourist ID
     * @param {string} aadhaarHash - Hashed Aadhaar number
     * @param {string} tripHash - Hashed trip details
     * @param {number} returnDate - Return date in Unix timestamp
     * @returns {Object} Transaction details
     */
    async registerTourist(dtid, aadhaarHash, tripHash, returnDate) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            console.log('📝 Registering tourist on blockchain...');
            console.log('   DTID:', dtid);
            console.log('   Return Date:', new Date(returnDate * 1000).toLocaleDateString());

            // Estimate gas before sending transaction
            const gasEstimate = await this.contract.estimateGas.registerTourist(
                dtid, 
                aadhaarHash, 
                tripHash, 
                returnDate
            );
            console.log('⛽ Estimated gas:', gasEstimate.toString());

            // Send transaction
            const tx = await this.contract.registerTourist(
                dtid,
                aadhaarHash,
                tripHash,
                returnDate
            );

            console.log('🚀 Transaction sent:', tx.hash);
            console.log('⏳ Waiting for confirmation...');

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            console.log('✅ Transaction confirmed!');
            console.log('   Block:', receipt.blockNumber);
            console.log('   Gas used:', receipt.gasUsed.toString());

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                explorerUrl: `https://amoy.polygonscan.com/tx/${tx.hash}`
            };

        } catch (error) {
            console.error('❌ Blockchain registration failed:', error.message);
            
            // Provide user-friendly error messages
            if (error.code === 'INSUFFICIENT_FUNDS') {
                throw new Error('Insufficient MATIC balance for gas fees. Get test MATIC from https://faucet.polygon.technology/');
            } else if (error.code === 'NETWORK_ERROR') {
                throw new Error('Network connection error. Please check your RPC URL.');
            } else if (error.message.includes('nonce')) {
                throw new Error('Transaction nonce error. Please try again.');
            }
            
            throw error;
        }
    }

    /**
     * Get tourist details from blockchain
     * @param {string} dtid - Digital Tourist ID
     * @returns {Object} Tourist data from blockchain
     */
    async getTourist(dtid) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const tourist = await this.contract.getTourist(dtid);

            return {
                dtid: tourist.dtid,
                aadhaarHash: tourist.aadhaarHash,
                tripHash: tourist.tripHash,
                issuedAt: tourist.issuedAt.toNumber(),
                returnDate: tourist.returnDate.toNumber(),
                isActive: tourist.isActive
            };

        } catch (error) {
            console.error('Error fetching tourist from blockchain:', error.message);
            throw error;
        }
    }

    /**
     * Check and update tourist status on blockchain
     * @param {string} dtid - Digital Tourist ID
     * @returns {Object} Transaction details
     */
    async checkAndUpdateStatus(dtid) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            console.log('🔄 Updating status for DTID:', dtid);

            const tx = await this.contract.checkAndUpdateStatus(dtid);
            const receipt = await tx.wait();

            console.log('✅ Status updated, tx:', tx.hash);

            return {
                success: true,
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber
            };

        } catch (error) {
            console.error('Error updating status:', error.message);
            throw error;
        }
    }

    /**
     * Check if tourist is active on blockchain
     * @param {string} dtid - Digital Tourist ID
     * @returns {boolean} Active status
     */
    async isActiveTourist(dtid) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const isActive = await this.contract.isActiveTourist(dtid);
            return isActive;

        } catch (error) {
            console.error('Error checking active status:', error.message);
            throw error;
        }
    }

    /**
     * Get current wallet address
     * @returns {string} Wallet address
     */
    async getWalletAddress() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return await this.signer.getAddress();
    }

    /**
     * Get wallet balance
     * @returns {string} Balance in MATIC
     */
    async getWalletBalance() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const address = await this.signer.getAddress();
        const balance = await this.provider.getBalance(address);
        return ethers.utils.formatEther(balance);
    }
}

// Export singleton instance
const blockchainService = new BlockchainService();

module.exports = blockchainService;
