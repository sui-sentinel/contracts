// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Sentinel is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ==================== Constants ====================
    uint8 constant REGISTER_AGENT_INTENT = 1;
    uint8 constant CONSUME_PROMPT_INTENT = 2;

    uint64 constant BASIS_POINTS = 10000;
    uint64 constant DEFAULT_AGENT_BALANCE_FEE = 5000;  // 50%
    uint64 constant DEFAULT_CREATOR_FEE = 4000;        // 40%
    uint64 constant DEFAULT_PROTOCOL_FEE = 1000;       // 10%
    uint64 constant WITHDRAWAL_LOCK_PERIOD = 14 days;
    uint64 constant PROMPT_UPDATE_WINDOW = 3 hours;
    uint64 constant MAX_SIGNATURE_AGE = 60 seconds;
    uint64 constant DEFAULT_FEE_INCREASE_BPS = 100;      // 1% increase per attack
    uint64 constant DEFAULT_MAX_FEE_MULTIPLIER_BPS = 30000; // 3x max fee cap
    uint256 constant MAX_TEXT_LENGTH = 64000;

    // ==================== Errors ====================
    error InvalidSignature();
    error AgentNotFound();
    error InsufficientBalance();
    error InvalidAmount();
    error NotAuthorized();
    error AttackAgentMismatch();
    error InvalidFeeRatio();
    error WithdrawalLocked();
    error AttackWindowClosed();
    error PromptUpdateLocked();
    error TextTooLong();
    error EnclaveNotSet();
    error InvalidEnclave();
    error TokenNotWhitelisted();
    error ProtocolPaused();
    error InsufficientInitialFund();
    error AgentAlreadyExists();
    error InvalidAttack();
    error SignatureExpired();
    error SignatureFuture();

    // ==================== Structs ====================
    struct Agent {
        string agentId;
        uint256 costPerMessage;
        string systemPrompt;
        uint256 balance;
        uint256 accumulatedFees;
        uint256 lastFundedTimestamp;
        uint256 createdAt;
        uint256 attackCount;
        address token;
        address owner;
        bool exists;
    }

    struct Attack {
        string agentId;
        address attacker;
        uint256 paidAmount;
        uint256 nonce;
        address token;
        bool exists;
    }

    struct ProtocolConfig {
        address protocolWallet;
        uint64 agentBalanceFee;
        uint64 creatorFee;
        uint64 protocolFee;
        uint64 feeIncreaseBps;
        uint64 maxFeeMultiplierBps;
        bool isPaused;
    }

    struct RegisterAgentParams {
        string agentId;
        uint256 costPerMessage;
        string systemPrompt;
        bool isDefeated;
        address creator;
    }

    struct ConsumePromptParams {
        string agentId;
        bool success;
        uint8 score;
        address attacker;
        uint256 nonce;
        bytes32 messageHash;
        string agentResponse;
        string juryResponse;
        string funResponse;
    }

    // ==================== Events ====================
    event EnclaveRegistered(address indexed enclaveAddress, uint256 timestamp);
    event EnclaveUpdated(address indexed oldEnclave, address indexed newEnclave, uint256 timestamp);

    event AgentRegistered(
        string agentId,
        string prompt,
        uint256 costPerMessage,
        uint256 initialBalance,
        address indexed token
    );

    event PromptConsumed(
        string agentId,
        bool success,
        uint256 amount,
        address indexed sender,
        string message,
        string agentResponse,
        string juryResponse,
        string funResponse,
        uint8 score,
        address indexed token
    );

    event FeeTransferred(
        string agentId,
        uint256 amountToAgent,
        uint256 amountToOwner,
        uint256 amountToProtocol,
        uint256 totalAmount,
        address indexed token
    );

    event AgentFunded(
        string agentId,
        uint256 amount,
        uint256 fundedTimestamp,
        uint256 unlockTimestamp,
        address indexed token
    );

    event AgentDefeated(
        string agentId,
        address indexed winner,
        uint8 score,
        uint256 amountWon,
        address indexed token
    );

    event FeeRatiosUpdated(
        uint64 agentBalanceFee,
        uint64 creatorFee,
        uint64 protocolFee,
        address indexed updatedBy
    );

    event ProtocolWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet,
        address indexed updatedBy
    );

    event FundsWithdrawn(
        string agentId,
        uint256 amount,
        uint256 withdrawnAt,
        address indexed token
    );

    event FeesClaimed(
        string agentId,
        address indexed owner,
        uint256 amount,
        address indexed token
    );

    event AttackRequested(
        uint256 indexed attackId,
        string agentId,
        address indexed attacker,
        uint256 amount,
        uint256 nonce
    );

    event ProtocolPausedEvent(address indexed pausedBy, uint256 timestamp);
    event ProtocolUnpausedEvent(address indexed unpausedBy, uint256 timestamp);
    event TokenWhitelisted(address indexed token);
    event TokenRemovedFromWhitelist(address indexed token);

    // ==================== State Variables ====================
    address public enclavePublicKey;
    ProtocolConfig public protocolConfig;

    mapping(string => Agent) public agents;
    mapping(uint256 => Attack) public attacks;
    mapping(address => bool) public whitelistedTokens;
    mapping(address => uint256) public minimumTokenAmounts;

    uint256 public agentCount;
    uint256 public attackNonce;

    // ==================== Modifiers ====================
    modifier whenNotPaused() {
        if (protocolConfig.isPaused) revert ProtocolPaused();
        _;
    }

    modifier onlyAgentOwner(string memory agentId) {
        if (agents[agentId].owner != msg.sender) revert NotAuthorized();
        _;
    }

    // ==================== Constructor ====================
    constructor(address _protocolWallet) Ownable(msg.sender) {
        protocolConfig = ProtocolConfig({
            protocolWallet: _protocolWallet,
            agentBalanceFee: DEFAULT_AGENT_BALANCE_FEE,
            creatorFee: DEFAULT_CREATOR_FEE,
            protocolFee: DEFAULT_PROTOCOL_FEE,
            feeIncreaseBps: DEFAULT_FEE_INCREASE_BPS,
            maxFeeMultiplierBps: DEFAULT_MAX_FEE_MULTIPLIER_BPS,
            isPaused: false
        });
    }

    // ==================== Enclave Functions ====================
    function registerEnclave(address _enclavePublicKey) external onlyOwner {
        if (enclavePublicKey != address(0)) revert EnclaveNotSet();
        enclavePublicKey = _enclavePublicKey;
        emit EnclaveRegistered(_enclavePublicKey, block.timestamp);
    }

    function updateEnclave(address _newEnclavePublicKey) external onlyOwner {
        if (enclavePublicKey == address(0)) revert EnclaveNotSet();
        address oldEnclave = enclavePublicKey;
        enclavePublicKey = _newEnclavePublicKey;
        emit EnclaveUpdated(oldEnclave, _newEnclavePublicKey, block.timestamp);
    }

    // ==================== Agent Functions ====================
    function registerAgent(
        string calldata agentId,
        uint256 timestampMs,
        uint256 costPerMessage,
        string calldata systemPrompt,
        address token,
        uint256 initialFund,
        bytes calldata signature
    ) external whenNotPaused nonReentrant {
        if (bytes(systemPrompt).length > MAX_TEXT_LENGTH) revert TextTooLong();
        if (!whitelistedTokens[token]) revert TokenNotWhitelisted();
        if (agents[agentId].exists) revert AgentAlreadyExists();
        if (initialFund < minimumTokenAmounts[token]) revert InsufficientInitialFund();
        if (enclavePublicKey == address(0)) revert EnclaveNotSet();

        // Verify signature
        RegisterAgentParams memory params = RegisterAgentParams({
            agentId: agentId,
            costPerMessage: costPerMessage,
            systemPrompt: systemPrompt,
            isDefeated: false,
            creator: msg.sender
        });

        _verifySignature(REGISTER_AGENT_INTENT, timestampMs, abi.encode(params), signature);

        // Transfer initial funds
        if (initialFund > 0) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), initialFund);
        }

        agents[agentId] = Agent({
            agentId: agentId,
            costPerMessage: costPerMessage,
            systemPrompt: systemPrompt,
            balance: initialFund,
            accumulatedFees: 0,
            lastFundedTimestamp: block.timestamp,
            createdAt: block.timestamp,
            attackCount: 0,
            token: token,
            owner: msg.sender,
            exists: true
        });

        agentCount++;

        emit AgentRegistered(agentId, systemPrompt, costPerMessage, initialFund, token);
    }

    function requestAttack(
        string calldata agentId,
        uint256 paymentAmount
    ) external whenNotPaused nonReentrant returns (uint256) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (!whitelistedTokens[agent.token]) revert TokenNotWhitelisted();
        if (_isWithdrawalUnlocked(agent)) revert AttackWindowClosed();

        uint256 effectiveCost = getEffectiveCost(agentId);
        if (paymentAmount < effectiveCost) revert InvalidAmount();

        // Transfer payment
        IERC20(agent.token).safeTransferFrom(msg.sender, address(this), paymentAmount);

        // Increment attack count
        agent.attackCount++;

        // Calculate fee distribution
        uint256 amountToOwner = (paymentAmount * protocolConfig.creatorFee) / BASIS_POINTS;
        uint256 amountToProtocol = (paymentAmount * protocolConfig.protocolFee) / BASIS_POINTS;
        uint256 amountToAgent = paymentAmount - amountToOwner - amountToProtocol;

        // Owner fees stored in accumulated fees
        agent.accumulatedFees += amountToOwner;

        // Protocol fee sent immediately
        if (amountToProtocol > 0) {
            IERC20(agent.token).safeTransfer(protocolConfig.protocolWallet, amountToProtocol);
        }

        // Agent balance (reward pool)
        agent.balance += amountToAgent;

        // Create attack
        uint256 currentNonce = ++attackNonce;
        attacks[currentNonce] = Attack({
            agentId: agentId,
            attacker: msg.sender,
            paidAmount: paymentAmount,
            nonce: currentNonce,
            token: agent.token,
            exists: true
        });

        emit FeeTransferred(agentId, amountToAgent, amountToOwner, amountToProtocol, paymentAmount, agent.token);
        emit AttackRequested(currentNonce, agentId, msg.sender, paymentAmount, currentNonce);

        return currentNonce;
    }

    function consumePrompt(
        string calldata agentId,
        bool success,
        string calldata agentResponse,
        string calldata juryResponse,
        string calldata funResponse,
        string calldata prompt,
        uint8 score,
        uint256 timestampMs,
        bytes calldata signature,
        uint256 attackId
    ) external whenNotPaused nonReentrant {
        Attack storage attack = attacks[attackId];
        if (!attack.exists) revert InvalidAttack();

        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (keccak256(bytes(agent.agentId)) != keccak256(bytes(attack.agentId))) revert AttackAgentMismatch();
        if (msg.sender != attack.attacker) revert NotAuthorized();
        if (bytes(prompt).length > MAX_TEXT_LENGTH) revert TextTooLong();

        bytes32 messageHash = keccak256(abi.encodePacked(prompt));

        ConsumePromptParams memory params = ConsumePromptParams({
            agentId: agentId,
            success: success,
            score: score,
            attacker: msg.sender,
            nonce: attack.nonce,
            messageHash: messageHash,
            agentResponse: agentResponse,
            juryResponse: juryResponse,
            funResponse: funResponse
        });

        _verifySignature(CONSUME_PROMPT_INTENT, timestampMs, abi.encode(params), signature);

        // Delete attack
        delete attacks[attackId];

        uint256 rewardAmount = 0;
        if (success && agent.balance > 0) {
            rewardAmount = agent.balance;
            agent.balance = 0;
            IERC20(agent.token).safeTransfer(msg.sender, rewardAmount);

            emit AgentDefeated(agentId, msg.sender, score, rewardAmount, agent.token);
        }

        emit PromptConsumed(
            agentId,
            success,
            rewardAmount,
            msg.sender,
            prompt,
            agentResponse,
            juryResponse,
            funResponse,
            score,
            agent.token
        );
    }

    function fundAgent(string calldata agentId, uint256 amount) external nonReentrant onlyAgentOwner(agentId) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();

        IERC20(agent.token).safeTransferFrom(msg.sender, address(this), amount);
        agent.balance += amount;
        agent.lastFundedTimestamp = block.timestamp;

        uint256 unlockTimestamp = block.timestamp + WITHDRAWAL_LOCK_PERIOD;
        emit AgentFunded(agentId, amount, block.timestamp, unlockTimestamp, agent.token);
    }

    function claimFees(string calldata agentId) external nonReentrant onlyAgentOwner(agentId) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (agent.accumulatedFees == 0) revert InsufficientBalance();

        uint256 amount = agent.accumulatedFees;
        agent.accumulatedFees = 0;

        IERC20(agent.token).safeTransfer(msg.sender, amount);

        emit FeesClaimed(agentId, msg.sender, amount, agent.token);
    }

    function withdrawFromAgent(string calldata agentId, uint256 amount) external nonReentrant onlyAgentOwner(agentId) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (agent.balance < amount) revert InsufficientBalance();
        if (!_isWithdrawalUnlocked(agent)) revert WithdrawalLocked();

        agent.balance -= amount;
        IERC20(agent.token).safeTransfer(msg.sender, amount);

        emit FundsWithdrawn(agentId, amount, block.timestamp, agent.token);
    }

    function updateAgentCost(string calldata agentId, uint256 newCost) external onlyAgentOwner(agentId) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (block.timestamp - agent.createdAt > PROMPT_UPDATE_WINDOW) revert PromptUpdateLocked();

        agent.costPerMessage = newCost;
    }

    function updateAgentPrompt(string calldata agentId, string calldata newPrompt) external onlyAgentOwner(agentId) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        if (bytes(newPrompt).length > MAX_TEXT_LENGTH) revert TextTooLong();
        if (block.timestamp - agent.createdAt > PROMPT_UPDATE_WINDOW) revert PromptUpdateLocked();

        agent.systemPrompt = newPrompt;
    }

    // ==================== Admin Functions ====================
    function updateFeeRatios(uint64 agentBalanceFee, uint64 creatorFee, uint64 protocolFee) external onlyOwner {
        if (agentBalanceFee + creatorFee + protocolFee != BASIS_POINTS) revert InvalidFeeRatio();

        protocolConfig.agentBalanceFee = agentBalanceFee;
        protocolConfig.creatorFee = creatorFee;
        protocolConfig.protocolFee = protocolFee;

        emit FeeRatiosUpdated(agentBalanceFee, creatorFee, protocolFee, msg.sender);
    }

    function updateProtocolWallet(address newWallet) external onlyOwner {
        address oldWallet = protocolConfig.protocolWallet;
        protocolConfig.protocolWallet = newWallet;

        emit ProtocolWalletUpdated(oldWallet, newWallet, msg.sender);
    }

    function updateDynamicFeeSettings(uint64 feeIncreaseBps, uint64 maxFeeMultiplierBps) external onlyOwner {
        if (maxFeeMultiplierBps < BASIS_POINTS) revert InvalidFeeRatio();

        protocolConfig.feeIncreaseBps = feeIncreaseBps;
        protocolConfig.maxFeeMultiplierBps = maxFeeMultiplierBps;
    }

    function pauseProtocol() external onlyOwner {
        protocolConfig.isPaused = true;
        emit ProtocolPausedEvent(msg.sender, block.timestamp);
    }

    function unpauseProtocol() external onlyOwner {
        protocolConfig.isPaused = false;
        emit ProtocolUnpausedEvent(msg.sender, block.timestamp);
    }

    function addWhitelistedToken(address token) external onlyOwner {
        whitelistedTokens[token] = true;
        emit TokenWhitelisted(token);
    }

    function removeWhitelistedToken(address token) external onlyOwner {
        whitelistedTokens[token] = false;
        emit TokenRemovedFromWhitelist(token);
    }

    function setMinimumTokenAmount(address token, uint256 amount) external onlyOwner {
        minimumTokenAmounts[token] = amount;
    }

    // ==================== View Functions ====================
    function getAgent(string calldata agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getAttack(uint256 attackId) external view returns (Attack memory) {
        return attacks[attackId];
    }

    function getEffectiveCost(string calldata agentId) public view returns (uint256) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();

        uint256 rawMultiplier = BASIS_POINTS + (agent.attackCount * protocolConfig.feeIncreaseBps);
        uint256 multiplier = rawMultiplier > protocolConfig.maxFeeMultiplierBps
            ? protocolConfig.maxFeeMultiplierBps
            : rawMultiplier;

        return (agent.costPerMessage * multiplier) / BASIS_POINTS;
    }

    function isWithdrawalUnlocked(string calldata agentId) external view returns (bool) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        return _isWithdrawalUnlocked(agent);
    }

    function getWithdrawalUnlockTimestamp(string calldata agentId) external view returns (uint256) {
        Agent storage agent = agents[agentId];
        if (!agent.exists) revert AgentNotFound();
        return agent.lastFundedTimestamp + WITHDRAWAL_LOCK_PERIOD;
    }

    function isTokenWhitelisted(address token) external view returns (bool) {
        return whitelistedTokens[token];
    }

    function getMinimumTokenAmount(address token) external view returns (uint256) {
        return minimumTokenAmounts[token];
    }

    // ==================== Internal Functions ====================
    function _isWithdrawalUnlocked(Agent storage agent) internal view returns (bool) {
        return block.timestamp - agent.lastFundedTimestamp >= WITHDRAWAL_LOCK_PERIOD;
    }

    function _verifySignature(
        uint8 intent,
        uint256 timestampMs,
        bytes memory payload,
        bytes calldata signature
    ) internal view {
        if (enclavePublicKey == address(0)) revert EnclaveNotSet();

        uint256 nowMs = block.timestamp * 1000;
        if (timestampMs > nowMs) revert SignatureFuture();
        if (nowMs - timestampMs > MAX_SIGNATURE_AGE * 1000) revert SignatureExpired();

        // Create intent message hash
        bytes32 messageHash = keccak256(abi.encodePacked(intent, timestampMs, payload));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        address recovered = ethSignedMessageHash.recover(signature);
        if (recovered != enclavePublicKey) revert InvalidSignature();
    }
}
