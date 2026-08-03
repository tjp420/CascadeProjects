'use strict';

/**
 * Track 14: Dynamic cryptographic policy engine.
 *
 * Provides runtime validation of HSM operations against per-tenant JSON
 * policies. Supports hot-reloading, default-deny fallbacks, deprecation
 * warnings, and algorithm/KEK-size constraints.
 *
 * @module hsm-adapter/crypto-policy-engine
 */

const fs = require('fs');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_POLICY = {
  version: '1.1.0',
  default: true,
  minimumKekBits: 128,
  keyExpirationDays: 0,
  allowEphemeralSecrets: false,
  allowedAlgorithms: {
    aes: { kw: true, kwp: true, bits: [128, 192, 256] },
    rsa: { oaep: true, minBits: 2048 },
    ecdh: { curves: ['P-256', 'P-384', 'P-521'] },
  },
  deprecatedAlgorithms: [],
  eviction: {
    inactivityEvictionSeconds: 0,
    zeroizeStrategy: 'random',
    auditOnEvict: true,
  },
  threshold: {
    minThreshold: 2,
    maxTotal: 7,
  },
  ratchet: {
    maxSkipped: 1000,
    sessionExpiryMs: 86400000,
    allowDhRatchet: true,
  },
  homomorphic: {
    maxModulusBits: 2048,
    tokenExpiryMs: 300000,
    allowBlinding: true,
  },
  pqc: {
    minKemLevel: 512,
    maxKemLevel: 1024,
    hybridMode: true,
    allowedCurves: ['P-256', 'P-384', 'P-521'],
  },
  zkp: {
    tokenExpiryMs: 300000,
    maxProofs: 100,
    allowedPrimes: [],
  },
  time: {
    maxDriftMs: 60000,
    minQuorum: 3,
    requireEpochChain: true,
  },
  escrow: {
    requireDualConsent: true,
    minAuthorizationQuorum: 2,
    maxEscrowLifetimeMs: 86400000,
    declassificationTokenExpiryMs: 300000,
    allowedEscrowAlgorithms: ['aes-kw', 'rsa-oaep'],
  },
  privacy: {
    blindSignature: {
      publicExponent: 65537,
      allowedPublicExponents: [65537],
      minModulusBits: 2048,
      allowedHashFunctions: ['sha256'],
      requireFullDomainHash: true,
    },
    pir: {
      maxRows: 10000,
      maxDimensions: 2,
      maxQuerySizeBytes: 1048576,
      allowedHomomorphicSchemes: ['paillier', 'bfv'],
    },
  },
  fips: {
    enabled: false,
    level: 3,
    allowedCurves: ['P-256', 'P-384'],
    allowedKemLevels: [768, 1024],
    graceTokenExpiryMs: 0,
    allowBlinding: false,
  },
  identity: {
    maxSkipped: 1000,
    sessionExpiryMs: 86400000,
    pqcKemLevel: 768,
    allowedPqcKemLevels: [512, 768, 1024],
    requireMfaBinding: true,
    mfaTokenExpiryMs: 300000,
    minMfaSignatures: 2,
    requirePqcHybridRatchet: true,
    allowedRatchetSchemes: ['ml-kem-768', 'ml-kem-1024'],
  },
  governance: {
    minAdminQuorum: 2,
    proposalExpiryMs: 86400000,
    allowedDerivationCurves: ['P-256', 'P-384', 'P-521'],
    allowedKemPrimitives: ['ml-kem-768', 'ml-kem-1024'],
    requirePqcBlindingFactor: true,
    maxChildDerivationDepth: 10,
  },
  recoverySync: {
    maxCatchUpBatchSize: 64,
    reSyncRetryLimit: 5,
    backoffBaseIntervalMs: 1000,
    maxBackOffMs: 60000,
    requireBftCatchUpAck: true,
    allowedCatchUpModes: ['sliding-window', 'checkpoint'],
  },
  consensus: {
    minQuorumNodes: 2,
    heartbeatIntervalMs: 500,
    electionTimeoutMs: 1500,
    electionTimeoutWindow: 300,
    maxLogBatchSize: 32,
    requireLeaderHeartbeat: true,
    allowedConsensusModes: ['raft', 'bft'],
    requireAsymmetricRpcSigning: false,
    allowedClusterPeerKeys: [],
    signatureAlgorithm: 'ed25519',
    enableReplayProtection: true,
    replayWindowMs: 5000,
    enablePeerKeyRotation: true,
    maxPeerKeyRotationRateMs: 1000,
    enableSnapshotCompaction: true,
    snapshotThresholdMin: 10,
    snapshotThresholdMax: 10000,
  },
  enclave: {
    allowedEnclaveTypes: ['mock', 'intel-sgx', 'aws-nitro'],
    requiredMRENCLAVEHashes: ['MOCK_MRENCLAVE_00000000000000000000000000000000'],
    allowedAttestationAuthorities: ['mock-authority'],
    requireRemoteAttestation: true,
    minAttestationTtlSeconds: 300,
    maxAttestationAgeSeconds: 60,
    allowedEnclaveCiphers: ['aes-256-gcm'],
  },
  secretSealing: {
    allowedSealingCiphers: ['aes-256-gcm', 'aes-128-gcm'],
    minSealingKeyBits: 128,
    maxSealingKeyAgeMs: 86400000,
    requireKeyRotation: true,
    keyRotationIntervalMs: 3600000,
    maxSealedDataSizeBytes: 1048576,
    allowUnsealOutsideEnclave: false,
    attestation: {
      requireChallengeResponse: true,
      challengeNonceBytes: 32,
      maxChallengeAgeMs: 30000,
      replayProtectionWindow: 300000,
      minTtlSeconds: 300,
      maxAgeSeconds: 60,
    },
    keyProvisioning: {
      allowedKeyTypes: ['kek', 'kek-fragment', 'wrap-key', 'signing-key'],
      maxKeyAgeMs: 604800000,
      requireAttestationBeforeProvision: true,
      maxProvisionedKeys: 100,
    },
  },
  resharding: {
    allowedThresholdWindows: [[2, 3], [3, 5], [5, 7]],
    maxCommitteeExpansionFactor: 2.0,
    maxCommitteeSize: 11,
    requireNewNodeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    requireEphemeralRatchet: true,
    minEpochIntervalMs: 1000,
  },
  disasterRecovery: {
    maxCrossRegionHeartbeatLatencyMs: 5000,
    minFailoverQuorumNodes: 3,
    allowedFailoverModes: ['bft-vote', 'operator-override'],
    requireStandbyAttestation: true,
    allowedStandbyAuthorities: ['mock-authority'],
    maxStateReconstructionAgeSeconds: 60,
    requireByzantineFaultProofs: true,
    minSurvivingRegions: 2,
  },
  confidentialIssuance: {
    minTokenBitLength: 256,
    allowedBlindingSchemes: ['pedersen', 'hash-to-curve'],
    requireMintingAttestation: true,
    allowedMintingAuthorities: ['mock-authority'],
    requireZkSnarkProof: true,
    minProofAgeSeconds: 0,
    maxProofAgeSeconds: 60,
    allowedCommitmentCurves: ['secp256k1', 'bn254'],
    minIssuanceQuorum: 2,
  },
  crossTenantAudit: {
    requireAttestationForBothEndpoints: true,
    allowedAttestationAuthorities: ['mock-authority'],
    minSignatureQuorumPerTenant: 2,
    maxVerificationWindowSeconds: 60,
    allowedOperations: ['key-escrow', 'blind-pir', 'identity-lookup'],
    requireDualLinkedProof: true,
    requireCanonicalReceiptLayout: true,
  },
  homomorphicComputation: {
    allowedOperations: ['add', 'scalarMul'],
    maxRangeBitWidth: 64,
    requireWorkerAttestation: true,
    allowedWorkerAuthorities: ['mock-authority'],
    maxContractVerificationWindowSeconds: 60,
    requireZkRangeProof: true,
    minRangeBits: 8,
    maxRangeBits: 4096,
  },
  hardwareRootRotation: {
    minAdminQuorum: 3,
    maxSignatureExpirationSeconds: 60,
    requireAdminAttestation: true,
    allowedAdminAuthorities: ['mock-authority'],
    requirePreviousSeedZeroization: true,
    maxRotationEpochIntervalSeconds: 86400,
    requireCanonicalPayloadLayout: true,
  },
  assetBridge: {
    minCommitteeQuorum: 3,
    maxAssetTransactionValue: 1000000,
    minLockEpochDuration: 60,
    maxClaimExpirationEpochs: 10,
    requireSourceAttestation: true,
    requireTargetAttestation: true,
    allowedBridgeAuthorities: ['mock-authority'],
    requireTimeLockEscrow: true,
    requireCanonicalPayloadLayout: true,
  },
  homomorphicDbLookup: {
    maxEncryptedColumnsPerQuery: 8,
    allowedBlindingTypes: ['pedersen', 'exponential-elgamal'],
    requireQueryAttestation: true,
    allowedQueryAuthorities: ['mock-authority'],
    maxQueryAgeSeconds: 60,
    requireZkMatchAttestation: true,
    allowCrossTenantTables: true,
    requireCanonicalPayloadLayout: true,
  },
  zkSettlement: {
    minClearingNodeQuorum: 3,
    maxSettlementTimeoutSeconds: 300,
    minAssetBitWidth: 8,
    maxAssetBitWidth: 256,
    requireNodeAttestation: true,
    allowedNodeAuthorities: ['mock-authority'],
    requireEqualityProof: true,
    requireCanonicalPayloadLayout: true,
  },
  dkg: {
    minQuorumThreshold: 3,
    maxNodes: 10,
    commitmentGroup: 'P-256',
    requireZkValidation: true,
  },
  pqcIdentityHub: {
    minIssuanceQuorum: 3,
    maxCommitteeSize: 10,
    kemAlgorithm: 'ML-KEM-1024',
    requireHostAttestation: true,
    requireCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    maxIdentityAgeSeconds: 86400,
    banUnattestedPeers: true,
    requireCanonicalPayloadLayout: true,
  },
  zkTokenAttestation: {
    minSignatureQuorum: 3,
    maxTokenLifetimeSeconds: 3600,
    permittedCurves: ['P-256', 'P-384', 'P-521'],
    requireBrokerAttestation: true,
    requireVerifierAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banExpiredProofNodes: true,
    maxScopesPerToken: 8,
    requireCanonicalPayloadLayout: true,
  },
  homomorphicKeySharding: {
    minTargetPlatformQuorum: 3,
    maxShardDepth: 8,
    signatureTimeoutSeconds: 300,
    requireLocalNodeAttestation: true,
    requireDestinationAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    kemAlgorithm: 'ML-KEM-1024',
    isolateLowQuorumDestinations: true,
    requireCanonicalPayloadLayout: true,
  },
  pqcThreshold: {
    minQuorumThreshold: 2,
    maxNodes: 10,
    allowedSigAlgorithms: ['ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87'],
    requireDkgValidation: true,
    requirePartialVerification: true,
    minSignatureThreshold: 3,
    maxCommitteeSize: 10,
    signatureAlgorithm: 'ML-DSA-65',
    requireHybridMode: true,
    allowedCurves: ['P-256', 'P-384', 'P-521'],
    maxSignatureAgeSeconds: 300,
    requireCanonicalPayloadLayout: true,
  },
  mpcGatedDecryption: {
    minCircuitNodes: 3,
    maxMultiplicationGateDepth: 8,
    transactionTimeoutSeconds: 300,
    requireEnclaveAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    requireCircuitSatisfactionProof: true,
    requireCanonicalPayloadLayout: true,
  },
  encryptedDeduplication: {
    minChunkBitLength: 256,
    maxChunkBitLength: 4096,
    maxCrossTenantChunkAllocations: 16,
    permittedBlindingGroups: ['P-256', 'P-384', 'P-521'],
    requireSubmitterAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedChunkPeers: true,
    requireCanonicalPayloadLayout: true,
  },
  confidentialSandbox: {
    maxExecutionTimeSeconds: 30,
    maxConcurrentSandboxes: 100,
    allowedOperations: ['sign', 'verify', 'encrypt', 'decrypt', 'derive', 'hash'],
    requireAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    requireZeroization: true,
    sandboxMemoryLimitBytes: 1048576,
  },
  encryptedSearchRouting: {
    maxKeywordsPerQuery: 32,
    maxIndexTraversalDepth: 16,
    allowedBlindingCurves: ['P-256', 'P-384', 'P-521'],
    requireSubmitterAttestation: true,
    requireIndexNodeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    minVerificationQuorum: 3,
    isolateLowQuorumIndexNodes: true,
    requireCanonicalPayloadLayout: true,
  },
  pqIdentityAccumulator: {
    maxTreeDepth: 20,
    allowedMembershipProofSystems: ['groth16', 'plonk', 'marlin'],
    mandatoryUpdateEpochSeconds: 3600,
    requireRootUpdateAttestation: true,
    requireMembershipProofAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedMembershipPeers: true,
    requireCanonicalPayloadLayout: true,
  },
  pqcVestingLocks: {
    minVestingEpochSeconds: 3600,
    minReleaseSignatureQuorum: 3,
    maxAssetValueCap: 1000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireClaimantAttestation: true,
    requireCommitteeRelayAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banExpiredOrDuplicateClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqcCrossChainGovernance: {
    minPlatformVotingQuorum: 3,
    maxConcurrentProposals: 16,
    maxProposalExecutionWindowSeconds: 86400,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireProposalBroadcasterAttestation: true,
    requireVerifierRelayAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderVotes: true,
    requireCanonicalPayloadLayout: true,
  },
  pqcHomomorphicIdentityBridge: {
    minCrossChainQuorum: 3,
    maxHomomorphicMatrixDepth: 32,
    maxIdentityProofWindowSeconds: 86400,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireRouterAttestation: true,
    requireCommitteeVerifierAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderProofs: true,
    requireCanonicalPayloadLayout: true,
  },
  pqIdentityRevocation: {
    minRevocationCommitteeQuorum: 3,
    maxRevocationListCapacity: 100000,
    maxProofExpirationSeconds: 3600,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requirePublisherAttestation: true,
    requireVerifierAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedNonMembershipProofs: true,
    requireCanonicalPayloadLayout: true,
  },
  pqTimeLockedMatrix: {
    minTimeDelaySeconds: 3600,
    minCommitteeQuorum: 3,
    maxPayloadBytes: 1048576,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireSubmitterAttestation: true,
    requireVerifierRelayAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banPrematureOrMalformedProofs: true,
    requireCanonicalPayloadLayout: true,
  },
  pqBlindOptionPools: {
    minCollateralRatio: 150,
    minExecutionSignatureQuorum: 3,
    maxContractLifetimeSeconds: 2592000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrSubCollateralProofs: true,
    requireCanonicalPayloadLayout: true,
  },
  pqPredictionMarkets: {
    minReporterQuorum: 3,
    maxDisputeResolutionEpochs: 5,
    maxContractLifetimeSeconds: 2592000,
    maxAssetWeightCap: 1000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireMarketInitializerAttestation: true,
    requireReporterRelayAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderResolutionClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqFractionalCustody: {
    minCustodianQuorum: 3,
    maxFractionalBits: 64,
    maxAssetCustodyCap: 1000000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireClaimantAttestation: true,
    requireCustodianRelayAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderCustodyClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqLendingPools: {
    minLtvRatio: 50,
    minLiquidationSignatureQuorum: 3,
    maxBorrowValueCap: 1000000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireBorrowerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrSubSolvencyClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqInsuranceUnderwriting: {
    minReserveRatio: 30,
    minClaimQuorum: 3,
    maxPoolRiskExposureCap: 1000000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireCoverageInitiatorAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderClaimAssertions: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSupplyChainEscrow: {
    minOrderMatchingQuorum: 3,
    maxProcurementDeliveryEpochs: 30,
    maxEscrowFundingCap: 1000000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireProcurementInitiatorAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderDeliveryAssertions: true,
    requireCanonicalPayloadLayout: true,
  },
  pqRealEstateTokenization: {
    minCoSignerQuorum: 3,
    maxLegalDisputeSeconds: 2592000,
    maxAssetValuationCap: 1000000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireAssetInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderTitleDeedAssertions: true,
    requireCanonicalPayloadLayout: true,
  },
  pqCarbonTokenization: {
    minRetirementQuorum: 3,
    maxVintageAgeSeconds: 63072000,
    maxCarbonTonnageCap: 1000000000,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireAssetInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderRetirementAssertions: true,
    requireCanonicalPayloadLayout: true,
  },
  pqIdentityGating: {
    minAttestationQuorum: 3,
    maxAttestationContractLifetimeSeconds: 31536000,
    maxCredentialDepth: 16,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireIdentityInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderIdentityClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqHealthDataGating: {
    minVerificationQuorum: 3,
    maxRecordExpirationLifetimeSeconds: 7776000,
    maxDiagnosticObservationDepth: 32,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireRecordInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderHealthClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqEducationGating: {
    minAccreditationQuorum: 3,
    maxTranscriptExpirationSeconds: 31536000,
    maxAcademicCredentialDepth: 24,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireInstitutionInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderCredentialClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqPatentGating: {
    minLicensingQuorum: 3,
    maxPatentExpirationSeconds: 47304000,
    maxClaimScopeDepth: 32,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requirePatentOfficeInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderPatentClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqEnergyGating: {
    minGridOperatorQuorum: 3,
    maxCertificateExpirationSeconds: 63072000,
    maxProductionMetricDepth: 48,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireGridOperatorInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderEnergyClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSupplyChainGating: {
    minSupplierCheckpointQuorum: 3,
    maxTransitExpirationSeconds: 7776000,
    maxComponentLineageDepth: 64,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireFactoryEndpointInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderProvenanceClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqBiometricGating: {
    minBiometricAuthorityQuorum: 3,
    maxTemplateExpirationSeconds: 15552000,
    maxLivenessMetricDepth: 16,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireBiometricAuthorityInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderBiometricClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqDerivativeGating: {
    minClearingHouseQuorum: 3,
    maxContractExpirationSeconds: 31536000,
    maxRiskMetricDepth: 32,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireClearingHouseInitializerAttestation: true,
    requireRiskCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderDerivativeClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqClinicalTrialGating: {
    minTrialOversightQuorum: 3,
    maxTrialDurationSeconds: 94608000,
    maxCohortMetricDepth: 24,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireTrialOversightInitializerAttestation: true,
    requireClearingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderTrialClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSortitionGating: {
    minSortitionQuorum: 3,
    maxSortitionEpochSeconds: 2592000,
    maxEntropyDepth: 16,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireSortitionAuthorityInitializerAttestation: true,
    requireAuditCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderSortitionClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqLogisticsGating: {
    minCustomsQuorum: 3,
    maxTransitWindowSeconds: 7776000,
    maxManifestDepth: 32,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireCustomsAuthorityInitializerAttestation: true,
    requireTradeCorridorCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderManifestClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqTrainingGating: {
    minTrainingOversightQuorum: 3,
    maxTrainingWindowSeconds: 63072000,
    maxProvenanceDepth: 64,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireTrainingAuthorityInitializerAttestation: true,
    requireModelAuditCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderTrainingClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqResearchGating: {
    minPeerReviewQuorum: 3,
    maxReplicationWindowSeconds: 15768000,
    maxCitationDepth: 48,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireResearchAuthorityInitializerAttestation: true,
    requireIntegrityCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderReplicationClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqTreasuryGating: {
    minProposalQuorum: 3,
    maxProposalWindowSeconds: 2592000,
    maxAllocationDepth: 16,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireGovernanceAuthorityInitializerAttestation: true,
    requireTreasuryOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderProposalClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqTelecomGating: {
    minTelecomPeeringQuorum: 3,
    maxAllocationWindowSeconds: 2592000,
    maxNetworkRoutingDepth: 32,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireCarrierEndpointInitializerAttestation: true,
    requireRoutingCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderTelecomClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqInsuranceGating: {
    minClaimsAuditQuorum: 3,
    maxClaimWindowSeconds: 5184000,
    maxBillingSequenceDepth: 24,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireInsuranceAuthorityInitializerAttestation: true,
    requireActuarialCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSpaceGating: {
    minOrbitalSlotQuorum: 5,
    maxSlotAllocationWindowSeconds: 31536000,
    maxTelemetryChainDepth: 16,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireSpaceAuthorityInitializerAttestation: true,
    requireOrbitalOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderOrbitalClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqWaterGating: {
    minWatershedQuorum: 4,
    maxAllocationWindowSeconds: 31536000,
    maxFlowChainDepth: 20,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireWaterAuthorityInitializerAttestation: true,
    requireWatershedOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderWaterClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqNuclearGating: {
    minSafeguardsQuorum: 6,
    maxInspectionWindowSeconds: 7776000,
    maxTelemetryChainDepth: 12,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireSafeguardsAuthorityInitializerAttestation: true,
    requireNuclearOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderSafeguardsClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqWildlifeGating: {
    minConservationQuorum: 4,
    maxMonitoringWindowSeconds: 2592000,
    maxTelemetryChainDepth: 14,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireConservationAuthorityInitializerAttestation: true,
    requireBiodiversityOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderConservationClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSmartGridGating: {
    minGridOperatorQuorum: 5,
    maxTransactionWindowSeconds: 86400,
    maxConsumptionChainDepth: 18,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireGridAuthorityInitializerAttestation: true,
    requireLoadBalanceOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderMicroTransactionClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqEpidemiologyGating: {
    minEpidemiologyQuorum: 5,
    maxSurveillanceWindowSeconds: 604800,
    maxGenomicChainDepth: 16,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireWhoAuthorityInitializerAttestation: true,
    requireEpidemiologyOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderEpidemiologicalClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqHeritageGating: {
    minAuthenticationQuorum: 4,
    maxAuthenticationWindowSeconds: 15552000,
    maxProvenanceChainDepth: 20,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireUnescoAuthorityInitializerAttestation: true,
    requireCulturalHeritageOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderAuthenticationClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqFisheriesGating: {
    minMaritimeQuorum: 5,
    maxCatchTrackingWindowSeconds: 2592000,
    maxVesselTelemetryChainDepth: 12,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireRfmoAuthorityInitializerAttestation: true,
    requireMarineSanctuaryOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderCatchClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSeabedGating: {
    minSovereignQuorum: 6,
    maxLeaseWindowSeconds: 31536000,
    maxExtractionChainDepth: 15,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireIsaAuthorityInitializerAttestation: true,
    requireSeabedOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderExtractionClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqPolarResearchGating: {
    minPolarQuorum: 5,
    maxDataRetentionWindowSeconds: 7776000,
    maxResearchChainDepth: 14,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireAntarcticTreatySecretariatInitializerAttestation: true,
    requirePolarResearchOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderResearchClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqStratosphericAerosolGating: {
    minClimateQuorum: 4,
    maxDeploymentWindowSeconds: 31536000,
    maxMonitoringChainDepth: 16,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireClimateAuthorityInitializerAttestation: true,
    requireStratosphericOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderAerosolClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqOrbitalDebrisTrackingGating: {
    minOrbitalQuorum: 5,
    maxCollisionWindowSeconds: 15768000,
    maxTrackingChainDepth: 18,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireSpaceSurveillanceAuthorityInitializerAttestation: true,
    requireOrbitalDebrisOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderDebrisClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqGenomicPrivacyComplianceGating: {
    minGenomicQuorum: 6,
    maxConsentWindowSeconds: 31536000,
    maxComplianceChainDepth: 20,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireGenomicPrivacyAuthorityInitializerAttestation: true,
    requireGenomicEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderGenomicClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqQuantumSensorCalibrationGating: {
    minQuantumQuorum: 7,
    maxCalibrationWindowSeconds: 7776000,
    maxCalibrationChainDepth: 22,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireQuantumMetrologyAuthorityInitializerAttestation: true,
    requireQuantumStandardsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderQuantumClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqNeuralNetworkInferenceIntegrityGating: {
    minNeuralQuorum: 8,
    maxInferenceWindowSeconds: 604800,
    maxInferenceChainDepth: 24,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireNeuralNetworkAuthorityInitializerAttestation: true,
    requireNeuralEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderNeuralClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqAutonomousVehicleFleetCoordinationGating: {
    minAutonomousQuorum: 9,
    maxCoordinationWindowSeconds: 86400,
    maxCoordinationChainDepth: 26,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireAutonomousMobilityAuthorityInitializerAttestation: true,
    requireAutonomousEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderAutonomousClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSupplyChainResilienceIntegrityGating: {
    minResilienceQuorum: 10,
    maxResilienceWindowSeconds: 172800,
    maxResilienceChainDepth: 28,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireSupplyChainResilienceAuthorityInitializerAttestation: true,
    requireSupplyChainEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderResilienceClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSmartContractVerifiableExecutionGating: {
    minExecutionQuorum: 10,
    maxExecutionWindowSeconds: 172800,
    maxExecutionChainDepth: 30,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireExecutionAuthorityInitializerAttestation: true,
    requireExecutionEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderExecutionClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqDecentralizedIdentityProofGating: {
    minIdentityQuorum: 12,
    maxRevocationWindowSeconds: 86400,
    maxIdentityChainDepth: 32,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireIdentityAuthorityInitializerAttestation: true,
    requireIdentityEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderIdentityClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqCrossShardAssetTeleportationGating: {
    minTeleportationQuorum: 14,
    maxFinalityWindowSeconds: 3600,
    maxTeleportationChainDepth: 36,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireTeleportationAuthorityInitializerAttestation: true,
    requireTeleportationEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderTeleportClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqDecentralizedEnergyGridBalancingGating: {
    minGridQuorum: 15,
    maxBalancingWindowSeconds: 1800,
    maxGridBalancingChainDepth: 38,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireEnergyGridAuthorityInitializerAttestation: true,
    requireGridEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderEnergyGridClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqSpaceBasedLaserCommunicationMeshGating: {
    minLaserMeshQuorum: 16,
    maxHandoffWindowSeconds: 300,
    maxLaserMeshChainDepth: 40,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireLaserMeshAuthorityInitializerAttestation: true,
    requireLaserEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderLaserMeshClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqQuantumKeyDistributionLinkSwitchGating: {
    minQkdQuorum: 18,
    maxEntanglementWindowSeconds: 60,
    maxQkdSwitchChainDepth: 42,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireQkdLinkAuthorityInitializerAttestation: true,
    requireQkdEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderQkdLinkClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  pqHolographicStorageContentAddressableGating: {
    minHolographicQuorum: 20,
    maxPhaseValidationWindowSeconds: 10,
    maxVolumetricChainDepth: 50,
    allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
    requireHolographicStorageAuthorityInitializerAttestation: true,
    requireHolographicEthicsOversightCommitteeAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    banMalformedOrOutOfOrderHolographicClaims: true,
    requireCanonicalPayloadLayout: true,
  },
  bftShardSync: {
    minQuorumNodes: 3,
    maxCatchUpBatchSize: 64,
    lagThreshold: 8,
    byzantineDivergenceThreshold: 100,
    requireQuorumCommit: true,
    requireAntiReplay: true,
    maxShardsPerCluster: 128,
  },
  crossClusterMigration: {
    minQuorumNodes: 3,
    requireAttestation: true,
    allowedAttestationAuthorities: ['mock-authority'],
    maxConcurrentMigrations: 16,
    requireQuorumCommit: true,
    requireRollbackOnFailure: true,
    maxShardsPerMigration: 32,
  },
  clusterKeyReconciliation: {
    minQuorumNodes: 3,
    maxEpochRollbackAttempts: 3,
    requireQuorumPromotion: true,
    requireAntiRollback: true,
    quarantineOnCriticalDivergence: true,
    maxTrackedKeys: 256,
  },
  zkProofOfAssets: {
    minQuorumNodes: 3,
    maxAssetsPerProof: 256,
    requireQuorumFinalization: true,
    requireAntiInflation: true,
    allowMultiTenantProofs: true,
    maxTenantsPerProof: 64,
  },
  multipartyReKeying: {
    minQuorumNodes: 3,
    maxReKeyingEpochs: 1000,
    requireQuorumCommit: true,
    requireAntiRollback: true,
    requireShareZeroization: true,
    allowThresholdAdjustment: true,
    maxShareholders: 32,
  },
  encryptedP2PRouting: {
    maxHopCount: 16,
    replayWindowMs: 30000,
    requireAntiReplay: true,
    requireOnionEncryption: true,
    allowRelayNodes: true,
    maxPeers: 128,
  },
  thresholdAccountRecovery: {
    minGuardians: 3,
    maxGuardians: 16,
    defaultTimeLockMs: 86400000,
    requireQuorumApproval: true,
    requireAntiReplay: true,
    allowGuardianManagement: true,
    maxActiveRecoveries: 100,
  },
  distributedConsensusCoordinator: {
    maxGroups: 64,
    faultTimeoutMs: 3000,
    faultCheckIntervalMs: 1000,
    viewChangeTimeoutMs: 5000,
    requireQuorumForProposals: true,
    allowDynamicGroupCreation: true,
    allowCrossGroupRouting: true,
  },
};

function _isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _mergeWithDefault(tenantPolicy) {
  // Shallow merge: tenant explicitly provided values win; missing values
  // fall back to the built-in default for a deny-by-default posture.
  // NOTE: ...tenantPolicy is spread FIRST so the explicit nested-merge
  // keys below always win. Spreading it last (a prior bug) clobbered the
  // deep-merged zkp/threshold/ratchet/etc. blocks with whatever the
  // tenant provided (often {} or undefined), causing defaults to vanish.
  return {
    ...DEFAULT_POLICY,
    ...tenantPolicy,
    allowedAlgorithms: {
      aes: { ...DEFAULT_POLICY.allowedAlgorithms.aes, ...(tenantPolicy.allowedAlgorithms && tenantPolicy.allowedAlgorithms.aes) },
      rsa: { ...DEFAULT_POLICY.allowedAlgorithms.rsa, ...(tenantPolicy.allowedAlgorithms && tenantPolicy.allowedAlgorithms.rsa) },
      ecdh: { ...DEFAULT_POLICY.allowedAlgorithms.ecdh, ...(tenantPolicy.allowedAlgorithms && tenantPolicy.allowedAlgorithms.ecdh) },
    },
    deprecatedAlgorithms: tenantPolicy.deprecatedAlgorithms || DEFAULT_POLICY.deprecatedAlgorithms,
    eviction: {
      ...DEFAULT_POLICY.eviction,
      ...(tenantPolicy.eviction || {}),
    },
    threshold: {
      ...DEFAULT_POLICY.threshold,
      ...(tenantPolicy.threshold || {}),
    },
    ratchet: {
      ...DEFAULT_POLICY.ratchet,
      ...(tenantPolicy.ratchet || {}),
    },
    homomorphic: {
      ...DEFAULT_POLICY.homomorphic,
      ...(tenantPolicy.homomorphic || {}),
    },
    pqc: {
      ...DEFAULT_POLICY.pqc,
      ...(tenantPolicy.pqc || {}),
    },
    zkp: {
      ...DEFAULT_POLICY.zkp,
      ...(tenantPolicy.zkp || {}),
    },
    time: {
      ...DEFAULT_POLICY.time,
      ...(tenantPolicy.time || {}),
    },
    fips: {
      ...DEFAULT_POLICY.fips,
      ...(tenantPolicy.fips || {}),
    },
    escrow: {
      ...DEFAULT_POLICY.escrow,
      ...(tenantPolicy.escrow || {}),
    },
    privacy: {
      ...DEFAULT_POLICY.privacy,
      blindSignature: {
        ...DEFAULT_POLICY.privacy.blindSignature,
        ...((tenantPolicy.privacy && tenantPolicy.privacy.blindSignature) || {}),
      },
      pir: {
        ...DEFAULT_POLICY.privacy.pir,
        ...((tenantPolicy.privacy && tenantPolicy.privacy.pir) || {}),
      },
    },
    fips: {
      ...DEFAULT_POLICY.fips,
      ...(tenantPolicy.fips || {}),
    },
    identity: {
      ...DEFAULT_POLICY.identity,
      ...(tenantPolicy.identity || {}),
    },
    governance: {
      ...DEFAULT_POLICY.governance,
      ...(tenantPolicy.governance || {}),
    },
    recoverySync: {
      ...DEFAULT_POLICY.recoverySync,
      ...(tenantPolicy.recoverySync || {}),
    },
    consensus: {
      ...DEFAULT_POLICY.consensus,
      ...(tenantPolicy.consensus || {}),
    },
    enclave: {
      ...DEFAULT_POLICY.enclave,
      ...(tenantPolicy.enclave || {}),
    },
    resharding: {
      ...DEFAULT_POLICY.resharding,
      ...(tenantPolicy.resharding || {}),
    },
    disasterRecovery: {
      ...DEFAULT_POLICY.disasterRecovery,
      ...(tenantPolicy.disasterRecovery || {}),
    },
    confidentialIssuance: {
      ...DEFAULT_POLICY.confidentialIssuance,
      ...(tenantPolicy.confidentialIssuance || {}),
    },
    crossTenantAudit: {
      ...DEFAULT_POLICY.crossTenantAudit,
      ...(tenantPolicy.crossTenantAudit || {}),
    },
    homomorphicComputation: {
      ...DEFAULT_POLICY.homomorphicComputation,
      ...(tenantPolicy.homomorphicComputation || {}),
    },
    hardwareRootRotation: {
      ...DEFAULT_POLICY.hardwareRootRotation,
      ...(tenantPolicy.hardwareRootRotation || {}),
    },
    assetBridge: {
      ...DEFAULT_POLICY.assetBridge,
      ...(tenantPolicy.assetBridge || {}),
    },
    homomorphicDbLookup: {
      ...DEFAULT_POLICY.homomorphicDbLookup,
      ...(tenantPolicy.homomorphicDbLookup || {}),
    },
    zkSettlement: {
      ...DEFAULT_POLICY.zkSettlement,
      ...(tenantPolicy.zkSettlement || {}),
    },
    dkg: {
      ...DEFAULT_POLICY.dkg,
      ...(tenantPolicy.dkg || {}),
    },
    pqcIdentityHub: {
      ...DEFAULT_POLICY.pqcIdentityHub,
      ...(tenantPolicy.pqcIdentityHub || {}),
    },
    zkTokenAttestation: {
      ...DEFAULT_POLICY.zkTokenAttestation,
      ...(tenantPolicy.zkTokenAttestation || {}),
    },
    homomorphicKeySharding: {
      ...DEFAULT_POLICY.homomorphicKeySharding,
      ...(tenantPolicy.homomorphicKeySharding || {}),
    },
    pqcThreshold: {
      ...DEFAULT_POLICY.pqcThreshold,
      ...(tenantPolicy.pqcThreshold || {}),
    },
    mpcGatedDecryption: {
      ...DEFAULT_POLICY.mpcGatedDecryption,
      ...(tenantPolicy.mpcGatedDecryption || {}),
    },
    encryptedDeduplication: {
      ...DEFAULT_POLICY.encryptedDeduplication,
      ...(tenantPolicy.encryptedDeduplication || {}),
    },
    confidentialSandbox: {
      ...DEFAULT_POLICY.confidentialSandbox,
      ...(tenantPolicy.confidentialSandbox || {}),
    },
    bftShardSync: {
      ...DEFAULT_POLICY.bftShardSync,
      ...(tenantPolicy.bftShardSync || {}),
    },
    crossClusterMigration: {
      ...DEFAULT_POLICY.crossClusterMigration,
      ...(tenantPolicy.crossClusterMigration || {}),
    },
    clusterKeyReconciliation: {
      ...DEFAULT_POLICY.clusterKeyReconciliation,
      ...(tenantPolicy.clusterKeyReconciliation || {}),
    },
    zkProofOfAssets: {
      ...DEFAULT_POLICY.zkProofOfAssets,
      ...(tenantPolicy.zkProofOfAssets || {}),
    },
    multipartyReKeying: {
      ...DEFAULT_POLICY.multipartyReKeying,
      ...(tenantPolicy.multipartyReKeying || {}),
    },
    encryptedP2PRouting: {
      ...DEFAULT_POLICY.encryptedP2PRouting,
      ...(tenantPolicy.encryptedP2PRouting || {}),
    },
    thresholdAccountRecovery: {
      ...DEFAULT_POLICY.thresholdAccountRecovery,
      ...(tenantPolicy.thresholdAccountRecovery || {}),
    },
    distributedConsensusCoordinator: {
      ...DEFAULT_POLICY.distributedConsensusCoordinator,
      ...(tenantPolicy.distributedConsensusCoordinator || {}),
    },
    encryptedSearchRouting: {
      ...DEFAULT_POLICY.encryptedSearchRouting,
      ...(tenantPolicy.encryptedSearchRouting || {}),
    },
    pqIdentityAccumulator: {
      ...DEFAULT_POLICY.pqIdentityAccumulator,
      ...(tenantPolicy.pqIdentityAccumulator || {}),
    },
    pqcVestingLocks: {
      ...DEFAULT_POLICY.pqcVestingLocks,
      ...(tenantPolicy.pqcVestingLocks || {}),
    },
    pqcCrossChainGovernance: {
      ...DEFAULT_POLICY.pqcCrossChainGovernance,
      ...(tenantPolicy.pqcCrossChainGovernance || {}),
    },
    pqcHomomorphicIdentityBridge: {
      ...DEFAULT_POLICY.pqcHomomorphicIdentityBridge,
      ...(tenantPolicy.pqcHomomorphicIdentityBridge || {}),
    },
    pqIdentityRevocation: {
      ...DEFAULT_POLICY.pqIdentityRevocation,
      ...(tenantPolicy.pqIdentityRevocation || {}),
    },
    pqTimeLockedMatrix: {
      ...DEFAULT_POLICY.pqTimeLockedMatrix,
      ...(tenantPolicy.pqTimeLockedMatrix || {}),
    },
    pqBlindOptionPools: {
      ...DEFAULT_POLICY.pqBlindOptionPools,
      ...(tenantPolicy.pqBlindOptionPools || {}),
    },
    pqPredictionMarkets: {
      ...DEFAULT_POLICY.pqPredictionMarkets,
      ...(tenantPolicy.pqPredictionMarkets || {}),
    },
    pqFractionalCustody: {
      ...DEFAULT_POLICY.pqFractionalCustody,
      ...(tenantPolicy.pqFractionalCustody || {}),
    },
    pqLendingPools: {
      ...DEFAULT_POLICY.pqLendingPools,
      ...(tenantPolicy.pqLendingPools || {}),
    },
    pqInsuranceUnderwriting: {
      ...DEFAULT_POLICY.pqInsuranceUnderwriting,
      ...(tenantPolicy.pqInsuranceUnderwriting || {}),
    },
    pqSupplyChainEscrow: {
      ...DEFAULT_POLICY.pqSupplyChainEscrow,
      ...(tenantPolicy.pqSupplyChainEscrow || {}),
    },
    pqRealEstateTokenization: {
      ...DEFAULT_POLICY.pqRealEstateTokenization,
      ...(tenantPolicy.pqRealEstateTokenization || {}),
    },
    pqCarbonTokenization: {
      ...DEFAULT_POLICY.pqCarbonTokenization,
      ...(tenantPolicy.pqCarbonTokenization || {}),
    },
    pqIdentityGating: {
      ...DEFAULT_POLICY.pqIdentityGating,
      ...(tenantPolicy.pqIdentityGating || {}),
    },
    pqHealthDataGating: {
      ...DEFAULT_POLICY.pqHealthDataGating,
      ...(tenantPolicy.pqHealthDataGating || {}),
    },
    pqEducationGating: {
      ...DEFAULT_POLICY.pqEducationGating,
      ...(tenantPolicy.pqEducationGating || {}),
    },
    pqPatentGating: {
      ...DEFAULT_POLICY.pqPatentGating,
      ...(tenantPolicy.pqPatentGating || {}),
    },
    pqEnergyGating: {
      ...DEFAULT_POLICY.pqEnergyGating,
      ...(tenantPolicy.pqEnergyGating || {}),
    },
    pqSupplyChainGating: {
      ...DEFAULT_POLICY.pqSupplyChainGating,
      ...(tenantPolicy.pqSupplyChainGating || {}),
    },
    pqBiometricGating: {
      ...DEFAULT_POLICY.pqBiometricGating,
      ...(tenantPolicy.pqBiometricGating || {}),
    },
    pqDerivativeGating: {
      ...DEFAULT_POLICY.pqDerivativeGating,
      ...(tenantPolicy.pqDerivativeGating || {}),
    },
    pqClinicalTrialGating: {
      ...DEFAULT_POLICY.pqClinicalTrialGating,
      ...(tenantPolicy.pqClinicalTrialGating || {}),
    },
    pqSortitionGating: {
      ...DEFAULT_POLICY.pqSortitionGating,
      ...(tenantPolicy.pqSortitionGating || {}),
    },
    pqLogisticsGating: {
      ...DEFAULT_POLICY.pqLogisticsGating,
      ...(tenantPolicy.pqLogisticsGating || {}),
    },
    pqTrainingGating: {
      ...DEFAULT_POLICY.pqTrainingGating,
      ...(tenantPolicy.pqTrainingGating || {}),
    },
    pqResearchGating: {
      ...DEFAULT_POLICY.pqResearchGating,
      ...(tenantPolicy.pqResearchGating || {}),
    },
    pqTreasuryGating: {
      ...DEFAULT_POLICY.pqTreasuryGating,
      ...(tenantPolicy.pqTreasuryGating || {}),
    },
    pqTelecomGating: {
      ...DEFAULT_POLICY.pqTelecomGating,
      ...(tenantPolicy.pqTelecomGating || {}),
    },
    pqInsuranceGating: {
      ...DEFAULT_POLICY.pqInsuranceGating,
      ...(tenantPolicy.pqInsuranceGating || {}),
    },
    pqSpaceGating: {
      ...DEFAULT_POLICY.pqSpaceGating,
      ...(tenantPolicy.pqSpaceGating || {}),
    },
    pqWaterGating: {
      ...DEFAULT_POLICY.pqWaterGating,
      ...(tenantPolicy.pqWaterGating || {}),
    },
    pqNuclearGating: {
      ...DEFAULT_POLICY.pqNuclearGating,
      ...(tenantPolicy.pqNuclearGating || {}),
    },
    pqWildlifeGating: {
      ...DEFAULT_POLICY.pqWildlifeGating,
      ...(tenantPolicy.pqWildlifeGating || {}),
    },
    pqSmartGridGating: {
      ...DEFAULT_POLICY.pqSmartGridGating,
      ...(tenantPolicy.pqSmartGridGating || {}),
    },
    pqEpidemiologyGating: {
      ...DEFAULT_POLICY.pqEpidemiologyGating,
      ...(tenantPolicy.pqEpidemiologyGating || {}),
    },
    pqHeritageGating: {
      ...DEFAULT_POLICY.pqHeritageGating,
      ...(tenantPolicy.pqHeritageGating || {}),
    },
    pqFisheriesGating: {
      ...DEFAULT_POLICY.pqFisheriesGating,
      ...(tenantPolicy.pqFisheriesGating || {}),
    },
    pqSeabedGating: {
      ...DEFAULT_POLICY.pqSeabedGating,
      ...(tenantPolicy.pqSeabedGating || {}),
    },
    pqPolarResearchGating: {
      ...DEFAULT_POLICY.pqPolarResearchGating,
      ...(tenantPolicy.pqPolarResearchGating || {}),
    },
    pqStratosphericAerosolGating: {
      ...DEFAULT_POLICY.pqStratosphericAerosolGating,
      ...(tenantPolicy.pqStratosphericAerosolGating || {}),
    },
    pqOrbitalDebrisTrackingGating: {
      ...DEFAULT_POLICY.pqOrbitalDebrisTrackingGating,
      ...(tenantPolicy.pqOrbitalDebrisTrackingGating || {}),
    },
    pqGenomicPrivacyComplianceGating: {
      ...DEFAULT_POLICY.pqGenomicPrivacyComplianceGating,
      ...(tenantPolicy.pqGenomicPrivacyComplianceGating || {}),
    },
    pqQuantumSensorCalibrationGating: {
      ...DEFAULT_POLICY.pqQuantumSensorCalibrationGating,
      ...(tenantPolicy.pqQuantumSensorCalibrationGating || {}),
    },
    pqNeuralNetworkInferenceIntegrityGating: {
      ...DEFAULT_POLICY.pqNeuralNetworkInferenceIntegrityGating,
      ...(tenantPolicy.pqNeuralNetworkInferenceIntegrityGating || {}),
    },
    pqAutonomousVehicleFleetCoordinationGating: {
      ...DEFAULT_POLICY.pqAutonomousVehicleFleetCoordinationGating,
      ...(tenantPolicy.pqAutonomousVehicleFleetCoordinationGating || {}),
    },
    pqSupplyChainResilienceIntegrityGating: {
      ...DEFAULT_POLICY.pqSupplyChainResilienceIntegrityGating,
      ...(tenantPolicy.pqSupplyChainResilienceIntegrityGating || {}),
    },
    pqSmartContractVerifiableExecutionGating: {
      ...DEFAULT_POLICY.pqSmartContractVerifiableExecutionGating,
      ...(tenantPolicy.pqSmartContractVerifiableExecutionGating || {}),
    },
    pqDecentralizedIdentityProofGating: {
      ...DEFAULT_POLICY.pqDecentralizedIdentityProofGating,
      ...(tenantPolicy.pqDecentralizedIdentityProofGating || {}),
    },
    pqCrossShardAssetTeleportationGating: {
      ...DEFAULT_POLICY.pqCrossShardAssetTeleportationGating,
      ...(tenantPolicy.pqCrossShardAssetTeleportationGating || {}),
    },
    pqDecentralizedEnergyGridBalancingGating: {
      ...DEFAULT_POLICY.pqDecentralizedEnergyGridBalancingGating,
      ...(tenantPolicy.pqDecentralizedEnergyGridBalancingGating || {}),
    },
    pqSpaceBasedLaserCommunicationMeshGating: {
      ...DEFAULT_POLICY.pqSpaceBasedLaserCommunicationMeshGating,
      ...(tenantPolicy.pqSpaceBasedLaserCommunicationMeshGating || {}),
    },
    pqQuantumKeyDistributionLinkSwitchGating: {
      ...DEFAULT_POLICY.pqQuantumKeyDistributionLinkSwitchGating,
      ...(tenantPolicy.pqQuantumKeyDistributionLinkSwitchGating || {}),
    },
    pqHolographicStorageContentAddressableGating: {
      ...DEFAULT_POLICY.pqHolographicStorageContentAddressableGating,
      ...(tenantPolicy.pqHolographicStorageContentAddressableGating || {}),
    },
  };
}

class CryptoPolicyEngine {
  /**
   * @param {object} [policy] - full policy document with `default` and `tenants`
   * @param {object} [options]
   * @param {string} [options.path] - optional path for hot-reload
   * @param {boolean} [options.strict=true] - hard-block on policy violation
   */
  constructor(policy = DEFAULT_POLICY, options = {}) {
    this._path = options.path || null;
    this._strict = options.strict !== false;
    this._policy = this._parsePolicy(policy);
  }

  /**
   * Load a policy from a JSON file on disk.
   * @param {string} filePath
   * @param {object} [options]
   * @returns {CryptoPolicyEngine}
   */
  static load(filePath, options = {}) {
    if (!filePath) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', 'Policy file path is required');
    }
    let raw;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', `Cannot read policy file: ${err.message}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', `Invalid JSON policy: ${err.message}`);
    }
    return new CryptoPolicyEngine(parsed, { ...options, path: filePath });
  }

  /**
   * Hot-reload the policy from the configured file path.
   * @returns {void}
   */
  reload() {
    if (!this._path) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', 'No policy file path configured for reload');
    }
    this._policy = this._parsePolicy(CryptoPolicyEngine.load(this._path)._policy);
  }

  _parsePolicy(policy) {
    if (!_isObject(policy)) {
      throw new HsmAdapterError('POLICY_LOAD_FAILED', 'Policy must be an object');
    }
    return {
      version: policy.version || '0.0.0',
      default: _mergeWithDefault(policy.default || {}),
      tenants: policy.tenants && _isObject(policy.tenants)
        ? Object.fromEntries(Object.entries(policy.tenants).map(([k, v]) => [k, _mergeWithDefault(v)]))
        : {},
    };
  }

  _getTenantPolicy(tenantId) {
    return this._policy.tenants[tenantId] || this._policy.default;
  }

  /**
   * Public accessor for the resolved tenant policy.
   * @param {string} tenantId
   * @returns {object}
   */
  getPolicy(tenantId) {
    return this._getTenantPolicy(tenantId);
  }

  _validateBits(tenantPolicy, kekBits, label = 'kekBits') {
    if (typeof kekBits !== 'number') return;
    const min = tenantPolicy.minimumKekBits;
    if (kekBits < min) {
      throw new HsmAdapterError(
        'POLICY_VIOLATION_BLOCKED',
        `${label} ${kekBits} is below the tenant minimum of ${min}`
      );
    }
  }

  _validateIdentity(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.identity, ...(tenantPolicy.identity || {}) };
    if (typeof config.kemLevel === 'number' && !policy.allowedPqcKemLevels.includes(config.kemLevel)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `identity KEM level ${config.kemLevel} is not allowed; permitted: ${policy.allowedPqcKemLevels.join(', ')}`);
    }
    if (typeof config.scheme === 'string' && !policy.allowedRatchetSchemes.includes(config.scheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `identity ratchet scheme ${config.scheme} is not allowed; permitted: ${policy.allowedRatchetSchemes.join(', ')}`);
    }
    if (typeof config.skipped === 'number' && config.skipped > policy.maxSkipped) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `identity skipped count ${config.skipped} exceeds policy ${policy.maxSkipped}`);
    }
    if (policy.requireMfaBinding && !config.mfaBinding) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'identity MFA binding is required');
    }
    if (typeof config.mfaSignatures === 'number' && config.mfaSignatures < policy.minMfaSignatures) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `MFA signatures ${config.mfaSignatures} below policy minimum ${policy.minMfaSignatures}`);
    }
  }

  _validateGovernance(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.governance, ...(tenantPolicy.governance || {}) };
    if (typeof config.depth === 'number' && config.depth > policy.maxChildDerivationDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `derivation depth ${config.depth} exceeds max ${policy.maxChildDerivationDepth}`);
    }
    if (typeof config.curve === 'string' && !policy.allowedDerivationCurves.includes(config.curve)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `derivation curve ${config.curve} is not allowed; permitted: ${policy.allowedDerivationCurves.join(', ')}`);
    }
    if (typeof config.kemPrimitive === 'string' && !policy.allowedKemPrimitives.includes(config.kemPrimitive)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `KEM primitive ${config.kemPrimitive} is not allowed; permitted: ${policy.allowedKemPrimitives.join(', ')}`);
    }
    if (policy.requirePqcBlindingFactor && config.requirePqcBlindingFactor === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'PQC blinding factor is required for governance derivation');
    }
    if (typeof config.minAdminQuorum === 'number' && config.minAdminQuorum < policy.minAdminQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `admin quorum ${config.minAdminQuorum} below policy minimum ${policy.minAdminQuorum}`);
    }
  }

  _validateRecoverySync(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.recoverySync, ...(tenantPolicy.recoverySync || {}) };
    if (typeof config.maxCatchUpBatchSize === 'number' && config.maxCatchUpBatchSize > policy.maxCatchUpBatchSize) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `catch-up batch size ${config.maxCatchUpBatchSize} exceeds policy ${policy.maxCatchUpBatchSize}`);
    }
    if (typeof config.reSyncRetryLimit === 'number' && config.reSyncRetryLimit > policy.reSyncRetryLimit) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `retry limit ${config.reSyncRetryLimit} exceeds policy ${policy.reSyncRetryLimit}`);
    }
    if (typeof config.backoffBaseIntervalMs === 'number' && config.backoffBaseIntervalMs > policy.maxBackOffMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `back-off base interval ${config.backoffBaseIntervalMs} exceeds policy max ${policy.maxBackOffMs}`);
    }
    if (typeof config.catchUpMode === 'string' && !policy.allowedCatchUpModes.includes(config.catchUpMode)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `catch-up mode ${config.catchUpMode} is not allowed; permitted: ${policy.allowedCatchUpModes.join(', ')}`);
    }
    if (policy.requireBftCatchUpAck && config.bftAck === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'BFT catch-up ack is required');
    }
  }

  _validateConsensus(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.consensus, ...(tenantPolicy.consensus || {}) };
    if (typeof config.minQuorumNodes === 'number' && config.minQuorumNodes < policy.minQuorumNodes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `quorum nodes ${config.minQuorumNodes} below policy minimum ${policy.minQuorumNodes}`);
    }
    if (typeof config.heartbeatIntervalMs === 'number' && config.heartbeatIntervalMs < 100) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `heartbeat interval ${config.heartbeatIntervalMs}ms is too low (minimum 100ms)`);
    }
    if (typeof config.electionTimeoutMs === 'number' && config.electionTimeoutMs <= config.heartbeatIntervalMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `election timeout ${config.electionTimeoutMs}ms must exceed heartbeat interval ${config.heartbeatIntervalMs}ms`);
    }
    if (typeof config.maxLogBatchSize === 'number' && config.maxLogBatchSize > policy.maxLogBatchSize) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `log batch size ${config.maxLogBatchSize} exceeds policy ${policy.maxLogBatchSize}`);
    }
    if (typeof config.consensusMode === 'string' && !policy.allowedConsensusModes.includes(config.consensusMode)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `consensus mode ${config.consensusMode} is not allowed; permitted: ${policy.allowedConsensusModes.join(', ')}`);
    }
    if (policy.requireLeaderHeartbeat && config.requireLeaderHeartbeat === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'leader heartbeat is required');
    }
    if (policy.requireAsymmetricRpcSigning && config.requireAsymmetricRpcSigning === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'asymmetric RPC signing is required');
    }
    if (typeof config.signatureAlgorithm === 'string' && config.signatureAlgorithm !== policy.signatureAlgorithm) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature algorithm ${config.signatureAlgorithm} is not allowed; permitted: ${policy.signatureAlgorithm}`);
    }
    if (Array.isArray(config.allowedClusterPeerKeys) && policy.allowedClusterPeerKeys.length > 0) {
      for (const key of config.allowedClusterPeerKeys) {
        if (!policy.allowedClusterPeerKeys.includes(key)) {
          throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `peer key ${key} is not in the allowed cluster peer keys list`);
        }
      }
    }
    if (policy.enableReplayProtection && config.enableReplayProtection === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'replay protection is required and cannot be disabled');
    }
    if (typeof config.replayWindowMs === 'number' && config.replayWindowMs > policy.replayWindowMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `replay window ${config.replayWindowMs}ms exceeds policy maximum ${policy.replayWindowMs}ms`);
    }
    if (typeof config.replayWindowMs === 'number' && config.replayWindowMs < 100) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `replay window ${config.replayWindowMs}ms is too low (minimum 100ms)`);
    }
    if (policy.enablePeerKeyRotation && config.enablePeerKeyRotation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'peer key rotation is required and cannot be disabled');
    }
    if (typeof config.maxPeerKeyRotationRateMs === 'number' && config.maxPeerKeyRotationRateMs < policy.maxPeerKeyRotationRateMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `peer key rotation rate ${config.maxPeerKeyRotationRateMs}ms is below policy minimum ${policy.maxPeerKeyRotationRateMs}ms`);
    }
    if (policy.enableSnapshotCompaction && config.enableSnapshotCompaction === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'snapshot compaction is required and cannot be disabled');
    }
    if (typeof config.snapshotThreshold === 'number' && config.snapshotThreshold < policy.snapshotThresholdMin) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `snapshot threshold ${config.snapshotThreshold} is below policy minimum ${policy.snapshotThresholdMin}`);
    }
    if (typeof config.snapshotThreshold === 'number' && config.snapshotThreshold > policy.snapshotThresholdMax) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `snapshot threshold ${config.snapshotThreshold} exceeds policy maximum ${policy.snapshotThresholdMax}`);
    }
  }

  _validateEnclave(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.enclave, ...(tenantPolicy.enclave || {}) };
    if (typeof config.enclaveType === 'string' && !policy.allowedEnclaveTypes.includes(config.enclaveType)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `enclave type ${config.enclaveType} is not allowed; permitted: ${policy.allowedEnclaveTypes.join(', ')}`);
    }
    if (typeof config.mrenclave === 'string' && policy.requiredMRENCLAVEHashes.length > 0 && !policy.requiredMRENCLAVEHashes.includes(config.mrenclave)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `MRENCLAVE ${config.mrenclave} is not in the allowed list`);
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (policy.requireRemoteAttestation && config.requireRemoteAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'remote attestation is required');
    }
    if (typeof config.attestationAgeSeconds === 'number' && config.attestationAgeSeconds > policy.maxAttestationAgeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation age ${config.attestationAgeSeconds}s exceeds maximum ${policy.maxAttestationAgeSeconds}s`);
    }
    if (typeof config.enclaveCipher === 'string' && !policy.allowedEnclaveCiphers.includes(config.enclaveCipher)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `enclave cipher ${config.enclaveCipher} is not allowed; permitted: ${policy.allowedEnclaveCiphers.join(', ')}`);
    }
  }

  _validateSecretSealing(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.secretSealing, ...(tenantPolicy.secretSealing || {}) };
    if (typeof config.cipher === 'string' && !policy.allowedSealingCiphers.includes(config.cipher)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sealing cipher ${config.cipher} is not allowed; permitted: ${policy.allowedSealingCiphers.join(', ')}`);
    }
    if (typeof config.keyBits === 'number' && config.keyBits < policy.minSealingKeyBits) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sealing key size ${config.keyBits} is below minimum ${policy.minSealingKeyBits} bits`);
    }
    if (typeof config.dataSizeBytes === 'number' && config.dataSizeBytes > policy.maxSealedDataSizeBytes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sealed data size ${config.dataSizeBytes} exceeds maximum ${policy.maxSealedDataSizeBytes} bytes`);
    }
    if (policy.requireKeyRotation && typeof config.keyAgeMs === 'number' && config.keyAgeMs > policy.keyRotationIntervalMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sealing key age ${config.keyAgeMs}ms exceeds rotation interval ${policy.keyRotationIntervalMs}ms`);
    }
    if (policy.requireKeyRotation && config.requireKeyRotation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'key rotation is required for sealing');
    }
    if (!policy.allowUnsealOutsideEnclave && config.allowUnsealOutsideEnclave === true) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'unseal outside enclave boundary is not allowed');
    }
    if (policy.keyProvisioning.requireAttestationBeforeProvision && config.attestationVerified === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'key provisioning requires attestation to be verified first');
    }
    if (typeof config.keyType === 'string' && !policy.keyProvisioning.allowedKeyTypes.includes(config.keyType)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `key type ${config.keyType} is not allowed; permitted: ${policy.keyProvisioning.allowedKeyTypes.join(', ')}`);
    }
  }

  _validateResharding(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.resharding, ...(tenantPolicy.resharding || {}) };
    if (config.threshold && config.committeeSize) {
      const window = policy.allowedThresholdWindows.find(([t, c]) => t === config.threshold && c === config.committeeSize);
      if (!window) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `threshold window ${config.threshold}-of-${config.committeeSize} is not allowed`);
      }
    }
    if (typeof config.committeeSize === 'number' && config.committeeSize > policy.maxCommitteeSize) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `committee size ${config.committeeSize} exceeds maximum ${policy.maxCommitteeSize}`);
    }
    if (typeof config.expansionFactor === 'number' && config.expansionFactor > policy.maxCommitteeExpansionFactor) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `expansion factor ${config.expansionFactor} exceeds maximum ${policy.maxCommitteeExpansionFactor}`);
    }
    if (typeof config.epochIntervalMs === 'number' && config.epochIntervalMs < policy.minEpochIntervalMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `epoch interval ${config.epochIntervalMs}ms below minimum ${policy.minEpochIntervalMs}ms`);
    }
    if (policy.requireEphemeralRatchet && config.requireEphemeralRatchet === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ephemeral ratchet is required');
    }
    if (policy.requireNewNodeAttestation && config.newNodeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'new node attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
  }

  _validateDisasterRecovery(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.disasterRecovery, ...(tenantPolicy.disasterRecovery || {}) };
    if (typeof config.crossRegionHeartbeatLatencyMs === 'number' && config.crossRegionHeartbeatLatencyMs > policy.maxCrossRegionHeartbeatLatencyMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `cross-region heartbeat latency ${config.crossRegionHeartbeatLatencyMs}ms exceeds maximum ${policy.maxCrossRegionHeartbeatLatencyMs}ms`);
    }
    if (typeof config.failoverQuorumNodes === 'number' && config.failoverQuorumNodes < policy.minFailoverQuorumNodes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `failover quorum ${config.failoverQuorumNodes} below minimum ${policy.minFailoverQuorumNodes}`);
    }
    if (typeof config.failoverMode === 'string' && !policy.allowedFailoverModes.includes(config.failoverMode)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `failover mode ${config.failoverMode} is not allowed; permitted: ${policy.allowedFailoverModes.join(', ')}`);
    }
    if (policy.requireStandbyAttestation && config.standbyAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'standby attestation is required');
    }
    if (typeof config.standbyAuthority === 'string' && !policy.allowedStandbyAuthorities.includes(config.standbyAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `standby authority ${config.standbyAuthority} is not allowed; permitted: ${policy.allowedStandbyAuthorities.join(', ')}`);
    }
    if (typeof config.stateReconstructionAgeSeconds === 'number' && config.stateReconstructionAgeSeconds > policy.maxStateReconstructionAgeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `state reconstruction age ${config.stateReconstructionAgeSeconds}s exceeds maximum ${policy.maxStateReconstructionAgeSeconds}s`);
    }
    if (typeof config.survivingRegions === 'number' && config.survivingRegions < policy.minSurvivingRegions) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `surviving regions ${config.survivingRegions} below minimum ${policy.minSurvivingRegions}`);
    }
    if (policy.requireByzantineFaultProofs && config.byantineFaultProofs === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'byzantine fault proofs are required');
    }
  }

  _validateConfidentialIssuance(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.confidentialIssuance, ...(tenantPolicy.confidentialIssuance || {}) };
    if (typeof config.tokenBitLength === 'number' && config.tokenBitLength < policy.minTokenBitLength) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `token bit length ${config.tokenBitLength} below minimum ${policy.minTokenBitLength}`);
    }
    if (typeof config.blindingScheme === 'string' && !policy.allowedBlindingSchemes.includes(config.blindingScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `blinding scheme ${config.blindingScheme} is not allowed; permitted: ${policy.allowedBlindingSchemes.join(', ')}`);
    }
    if (policy.requireMintingAttestation && config.mintingAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'minting attestation is required');
    }
    if (typeof config.mintingAuthority === 'string' && !policy.allowedMintingAuthorities.includes(config.mintingAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `minting authority ${config.mintingAuthority} is not allowed; permitted: ${policy.allowedMintingAuthorities.join(', ')}`);
    }
    if (policy.requireZkSnarkProof && config.zkSnarkProof === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'zk-snark proof is required');
    }
    if (typeof config.proofAgeSeconds === 'number' && config.proofAgeSeconds > policy.maxProofAgeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `proof age ${config.proofAgeSeconds}s exceeds maximum ${policy.maxProofAgeSeconds}s`);
    }
    if (typeof config.commitmentCurve === 'string' && !policy.allowedCommitmentCurves.includes(config.commitmentCurve)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `commitment curve ${config.commitmentCurve} is not allowed; permitted: ${policy.allowedCommitmentCurves.join(', ')}`);
    }
    if (typeof config.issuanceQuorum === 'number' && config.issuanceQuorum < policy.minIssuanceQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `issuance quorum ${config.issuanceQuorum} below minimum ${policy.minIssuanceQuorum}`);
    }
  }

  _validateCrossTenantAudit(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.crossTenantAudit, ...(tenantPolicy.crossTenantAudit || {}) };
    if (policy.requireAttestationForBothEndpoints && config.attestationForBothEndpoints === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'attestation is required for both endpoints');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.signatureQuorumPerTenant === 'number' && config.signatureQuorumPerTenant < policy.minSignatureQuorumPerTenant) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature quorum ${config.signatureQuorumPerTenant} below minimum ${policy.minSignatureQuorumPerTenant}`);
    }
    if (typeof config.verificationWindowSeconds === 'number' && config.verificationWindowSeconds > policy.maxVerificationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `verification window ${config.verificationWindowSeconds}s exceeds maximum ${policy.maxVerificationWindowSeconds}s`);
    }
    if (typeof config.operation === 'string' && !policy.allowedOperations.includes(config.operation)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `operation ${config.operation} is not allowed; permitted: ${policy.allowedOperations.join(', ')}`);
    }
    if (policy.requireDualLinkedProof && config.dualLinkedProof === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'dual-linked proof is required');
    }
    if (policy.requireCanonicalReceiptLayout && config.canonicalReceiptLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical receipt layout is required');
    }
  }

  _validateHomomorphicComputation(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.homomorphicComputation, ...(tenantPolicy.homomorphicComputation || {}) };
    if (typeof config.operation === 'string' && !policy.allowedOperations.includes(config.operation)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `homomorphic operation ${config.operation} is not allowed; permitted: ${policy.allowedOperations.join(', ')}`);
    }
    if (typeof config.rangeBitWidth === 'number' && (config.rangeBitWidth < policy.minRangeBits || config.rangeBitWidth > policy.maxRangeBits)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `range bit width ${config.rangeBitWidth} outside allowed [${policy.minRangeBits}, ${policy.maxRangeBits}]`);
    }
    if (policy.requireWorkerAttestation && config.workerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'worker attestation is required');
    }
    if (typeof config.workerAuthority === 'string' && !policy.allowedWorkerAuthorities.includes(config.workerAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `worker authority ${config.workerAuthority} is not allowed; permitted: ${policy.allowedWorkerAuthorities.join(', ')}`);
    }
    if (typeof config.contractVerificationWindowSeconds === 'number' && config.contractVerificationWindowSeconds > policy.maxContractVerificationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `contract verification window ${config.contractVerificationWindowSeconds}s exceeds maximum ${policy.maxContractVerificationWindowSeconds}s`);
    }
    if (policy.requireZkRangeProof && config.zkRangeProof === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'zk range proof is required');
    }
  }

  _validateHardwareRootRotation(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.hardwareRootRotation, ...(tenantPolicy.hardwareRootRotation || {}) };
    if (typeof config.adminQuorum === 'number' && config.adminQuorum < policy.minAdminQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `admin quorum ${config.adminQuorum} below minimum ${policy.minAdminQuorum}`);
    }
    if (typeof config.signatureAgeSeconds === 'number' && config.signatureAgeSeconds > policy.maxSignatureExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature age ${config.signatureAgeSeconds}s exceeds maximum ${policy.maxSignatureExpirationSeconds}s`);
    }
    if (policy.requireAdminAttestation && config.adminAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'admin attestation is required');
    }
    if (typeof config.adminAuthority === 'string' && !policy.allowedAdminAuthorities.includes(config.adminAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `admin authority ${config.adminAuthority} is not allowed; permitted: ${policy.allowedAdminAuthorities.join(', ')}`);
    }
    if (policy.requirePreviousSeedZeroization && config.previousSeedZeroized === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'previous seed zeroization is required');
    }
    if (typeof config.rotationEpochIntervalSeconds === 'number' && config.rotationEpochIntervalSeconds < policy.maxRotationEpochIntervalSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `rotation epoch interval ${config.rotationEpochIntervalSeconds}s below minimum ${policy.maxRotationEpochIntervalSeconds}s`);
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateAssetBridge(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.assetBridge, ...(tenantPolicy.assetBridge || {}) };
    if (typeof config.committeeQuorum === 'number' && config.committeeQuorum < policy.minCommitteeQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `committee quorum ${config.committeeQuorum} below minimum ${policy.minCommitteeQuorum}`);
    }
    if (typeof config.assetTransactionValue === 'number' && config.assetTransactionValue > policy.maxAssetTransactionValue) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `asset transaction value ${config.assetTransactionValue} exceeds maximum ${policy.maxAssetTransactionValue}`);
    }
    if (typeof config.lockEpochDuration === 'number' && config.lockEpochDuration < policy.minLockEpochDuration) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `lock epoch duration ${config.lockEpochDuration} below minimum ${policy.minLockEpochDuration}`);
    }
    if (typeof config.claimExpirationEpochs === 'number' && config.claimExpirationEpochs > policy.maxClaimExpirationEpochs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `claim expiration ${config.claimExpirationEpochs} exceeds maximum ${policy.maxClaimExpirationEpochs}`);
    }
    if (policy.requireSourceAttestation && config.sourceAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'source attestation is required');
    }
    if (policy.requireTargetAttestation && config.targetAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'target attestation is required');
    }
    if (typeof config.bridgeAuthority === 'string' && !policy.allowedBridgeAuthorities.includes(config.bridgeAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `bridge authority ${config.bridgeAuthority} is not allowed; permitted: ${policy.allowedBridgeAuthorities.join(', ')}`);
    }
    if (policy.requireTimeLockEscrow && config.timeLockEscrow === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'time-lock escrow is required');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateHomomorphicDbLookup(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.homomorphicDbLookup, ...(tenantPolicy.homomorphicDbLookup || {}) };
    if (typeof config.encryptedColumns === 'number' && config.encryptedColumns > policy.maxEncryptedColumnsPerQuery) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `encrypted columns ${config.encryptedColumns} exceed maximum ${policy.maxEncryptedColumnsPerQuery}`);
    }
    if (typeof config.blindingType === 'string' && !policy.allowedBlindingTypes.includes(config.blindingType)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `blinding type ${config.blindingType} is not allowed; permitted: ${policy.allowedBlindingTypes.join(', ')}`);
    }
    if (policy.requireQueryAttestation && config.queryAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'query attestation is required');
    }
    if (typeof config.queryAuthority === 'string' && !policy.allowedQueryAuthorities.includes(config.queryAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `query authority ${config.queryAuthority} is not allowed; permitted: ${policy.allowedQueryAuthorities.join(', ')}`);
    }
    if (typeof config.queryAgeSeconds === 'number' && config.queryAgeSeconds > policy.maxQueryAgeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `query age ${config.queryAgeSeconds}s exceeds maximum ${policy.maxQueryAgeSeconds}s`);
    }
    if (policy.requireZkMatchAttestation && config.zkMatchAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'zk match attestation is required');
    }
    if (typeof config.crossTenantTables === 'boolean' && !policy.allowCrossTenantTables && config.crossTenantTables) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'cross-tenant tables are not allowed');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateZkSettlement(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.zkSettlement, ...(tenantPolicy.zkSettlement || {}) };
    if (typeof config.clearingNodeQuorum === 'number' && config.clearingNodeQuorum < policy.minClearingNodeQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `clearing node quorum ${config.clearingNodeQuorum} below minimum ${policy.minClearingNodeQuorum}`);
    }
    if (typeof config.settlementTimeoutSeconds === 'number' && config.settlementTimeoutSeconds > policy.maxSettlementTimeoutSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `settlement timeout ${config.settlementTimeoutSeconds}s exceeds maximum ${policy.maxSettlementTimeoutSeconds}s`);
    }
    if (typeof config.assetBitWidth === 'number' && (config.assetBitWidth < policy.minAssetBitWidth || config.assetBitWidth > policy.maxAssetBitWidth)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `asset bit width ${config.assetBitWidth} outside allowed [${policy.minAssetBitWidth}, ${policy.maxAssetBitWidth}]`);
    }
    if (policy.requireNodeAttestation && config.nodeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'node attestation is required');
    }
    if (typeof config.nodeAuthority === 'string' && !policy.allowedNodeAuthorities.includes(config.nodeAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `node authority ${config.nodeAuthority} is not allowed; permitted: ${policy.allowedNodeAuthorities.join(', ')}`);
    }
    if (policy.requireEqualityProof && config.equalityProof === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'equality proof is required');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateDkg(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.dkg, ...(tenantPolicy.dkg || {}) };
    if (typeof config.quorumThreshold === 'number' && config.quorumThreshold < policy.minQuorumThreshold) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `quorum threshold ${config.quorumThreshold} below minimum ${policy.minQuorumThreshold}`);
    }
    if (typeof config.nodes === 'number' && config.nodes > policy.maxNodes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `nodes ${config.nodes} exceed maximum ${policy.maxNodes}`);
    }
    if (typeof config.polynomialDegree === 'number' && config.polynomialDegree >= (config.nodes || policy.maxNodes)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `polynomial degree ${config.polynomialDegree} must be less than node count ${config.nodes || policy.maxNodes}`);
    }
    if (typeof config.commitmentGroup === 'string' && config.commitmentGroup !== policy.commitmentGroup) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `commitment group ${config.commitmentGroup} is not allowed; permitted: ${policy.commitmentGroup}`);
    }
    if (policy.requireZkValidation && config.zkValidation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'zk validation is required');
    }
  }

  _validatePqcIdentityHub(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqcIdentityHub, ...(tenantPolicy.pqcIdentityHub || {}) };
    if (typeof config.issuanceQuorum === 'number' && config.issuanceQuorum < policy.minIssuanceQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `issuance quorum ${config.issuanceQuorum} below minimum ${policy.minIssuanceQuorum}`);
    }
    if (typeof config.committeeSize === 'number' && config.committeeSize > policy.maxCommitteeSize) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `committee size ${config.committeeSize} exceeds maximum ${policy.maxCommitteeSize}`);
    }
    if (typeof config.kemAlgorithm === 'string' && config.kemAlgorithm !== policy.kemAlgorithm) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `KEM algorithm ${config.kemAlgorithm} is not allowed; permitted: ${policy.kemAlgorithm}`);
    }
    if (policy.requireHostAttestation && config.hostAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'host attestation is required');
    }
    if (policy.requireCommitteeAttestation && config.committeeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.identityAgeSeconds === 'number' && config.identityAgeSeconds > policy.maxIdentityAgeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `identity age ${config.identityAgeSeconds}s exceeds maximum ${policy.maxIdentityAgeSeconds}s`);
    }
    if (typeof config.banUnattestedPeers === 'boolean' && policy.banUnattestedPeers && !config.banUnattestedPeers) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban unattested peers must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateZkTokenAttestation(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.zkTokenAttestation, ...(tenantPolicy.zkTokenAttestation || {}) };
    if (typeof config.signatureQuorum === 'number' && config.signatureQuorum < policy.minSignatureQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature quorum ${config.signatureQuorum} below minimum ${policy.minSignatureQuorum}`);
    }
    if (typeof config.tokenLifetimeSeconds === 'number' && config.tokenLifetimeSeconds > policy.maxTokenLifetimeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `token lifetime ${config.tokenLifetimeSeconds}s exceeds maximum ${policy.maxTokenLifetimeSeconds}s`);
    }
    if (typeof config.curve === 'string' && !policy.permittedCurves.includes(config.curve)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `curve ${config.curve} is not permitted; allowed: ${policy.permittedCurves.join(', ')}`);
    }
    if (policy.requireBrokerAttestation && config.brokerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'broker attestation is required');
    }
    if (policy.requireVerifierAttestation && config.verifierAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'verifier attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.scopesPerToken === 'number' && config.scopesPerToken > policy.maxScopesPerToken) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `scopes per token ${config.scopesPerToken} exceeds maximum ${policy.maxScopesPerToken}`);
    }
    if (typeof config.banExpiredProofNodes === 'boolean' && policy.banExpiredProofNodes && !config.banExpiredProofNodes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban expired proof nodes must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateHomomorphicKeySharding(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.homomorphicKeySharding, ...(tenantPolicy.homomorphicKeySharding || {}) };
    if (typeof config.targetPlatformQuorum === 'number' && config.targetPlatformQuorum < policy.minTargetPlatformQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `target platform quorum ${config.targetPlatformQuorum} below minimum ${policy.minTargetPlatformQuorum}`);
    }
    if (typeof config.shardDepth === 'number' && config.shardDepth > policy.maxShardDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `shard depth ${config.shardDepth} exceeds maximum ${policy.maxShardDepth}`);
    }
    if (typeof config.signatureAgeSeconds === 'number' && config.signatureAgeSeconds > policy.signatureTimeoutSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature age ${config.signatureAgeSeconds}s exceeds timeout ${policy.signatureTimeoutSeconds}s`);
    }
    if (policy.requireLocalNodeAttestation && config.localNodeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'local node attestation is required');
    }
    if (policy.requireDestinationAttestation && config.destinationAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'destination attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.kemAlgorithm === 'string' && config.kemAlgorithm !== policy.kemAlgorithm) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `KEM algorithm ${config.kemAlgorithm} is not allowed; permitted: ${policy.kemAlgorithm}`);
    }
    if (typeof config.isolateLowQuorumDestinations === 'boolean' && policy.isolateLowQuorumDestinations && !config.isolateLowQuorumDestinations) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'isolate low quorum destinations must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqcThreshold(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqcThreshold, ...(tenantPolicy.pqcThreshold || {}) };
    if (typeof config.signatureThreshold === 'number' && config.signatureThreshold < policy.minSignatureThreshold) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature threshold ${config.signatureThreshold} below minimum ${policy.minSignatureThreshold}`);
    }
    if (typeof config.committeeSize === 'number' && config.committeeSize > policy.maxCommitteeSize) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `committee size ${config.committeeSize} exceeds maximum ${policy.maxCommitteeSize}`);
    }
    if (typeof config.signatureAlgorithm === 'string' && config.signatureAlgorithm !== policy.signatureAlgorithm) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature algorithm ${config.signatureAlgorithm} is not allowed; permitted: ${policy.signatureAlgorithm}`);
    }
    if (policy.requireHybridMode && config.hybridMode === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'hybrid mode is required');
    }
    if (typeof config.curve === 'string' && !policy.allowedCurves.includes(config.curve)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `curve ${config.curve} is not permitted; allowed: ${policy.allowedCurves.join(', ')}`);
    }
    if (typeof config.signatureAgeSeconds === 'number' && config.signatureAgeSeconds > policy.maxSignatureAgeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `signature age ${config.signatureAgeSeconds}s exceeds maximum ${policy.maxSignatureAgeSeconds}s`);
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateMpcGatedDecryption(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.mpcGatedDecryption, ...(tenantPolicy.mpcGatedDecryption || {}) };
    if (typeof config.circuitNodes === 'number' && config.circuitNodes < policy.minCircuitNodes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `circuit nodes ${config.circuitNodes} below minimum ${policy.minCircuitNodes}`);
    }
    if (typeof config.multiplicationGateDepth === 'number' && config.multiplicationGateDepth > policy.maxMultiplicationGateDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `multiplication gate depth ${config.multiplicationGateDepth} exceeds maximum ${policy.maxMultiplicationGateDepth}`);
    }
    if (typeof config.transactionAgeSeconds === 'number' && config.transactionAgeSeconds > policy.transactionTimeoutSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `transaction age ${config.transactionAgeSeconds}s exceeds timeout ${policy.transactionTimeoutSeconds}s`);
    }
    if (policy.requireEnclaveAttestation && config.enclaveAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'enclave attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (policy.requireCircuitSatisfactionProof && config.circuitSatisfactionProof === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'circuit satisfaction proof is required');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateEncryptedDeduplication(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.encryptedDeduplication, ...(tenantPolicy.encryptedDeduplication || {}) };
    if (typeof config.chunkBitLength === 'number' && config.chunkBitLength < policy.minChunkBitLength) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `chunk bit length ${config.chunkBitLength} below minimum ${policy.minChunkBitLength}`);
    }
    if (typeof config.chunkBitLength === 'number' && config.chunkBitLength > policy.maxChunkBitLength) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `chunk bit length ${config.chunkBitLength} exceeds maximum ${policy.maxChunkBitLength}`);
    }
    if (typeof config.crossTenantChunkAllocations === 'number' && config.crossTenantChunkAllocations > policy.maxCrossTenantChunkAllocations) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `cross-tenant chunk allocations ${config.crossTenantChunkAllocations} exceeds maximum ${policy.maxCrossTenantChunkAllocations}`);
    }
    if (typeof config.blindingGroup === 'string' && !policy.permittedBlindingGroups.includes(config.blindingGroup)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `blinding group ${config.blindingGroup} is not permitted; allowed: ${policy.permittedBlindingGroups.join(', ')}`);
    }
    if (policy.requireSubmitterAttestation && config.submitterAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'submitter attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedChunkPeers === 'boolean' && policy.banMalformedChunkPeers && !config.banMalformedChunkPeers) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed chunk peers must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateConfidentialSandbox(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.confidentialSandbox, ...(tenantPolicy.confidentialSandbox || {}) };
    if (typeof config.executionTimeSeconds === 'number' && config.executionTimeSeconds > policy.maxExecutionTimeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `execution time ${config.executionTimeSeconds}s exceeds maximum ${policy.maxExecutionTimeSeconds}s`);
    }
    if (typeof config.concurrentSandboxes === 'number' && config.concurrentSandboxes > policy.maxConcurrentSandboxes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `concurrent sandboxes ${config.concurrentSandboxes} exceeds maximum ${policy.maxConcurrentSandboxes}`);
    }
    if (typeof config.operation === 'string' && !policy.allowedOperations.includes(config.operation)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `operation ${config.operation} is not allowed; permitted: ${policy.allowedOperations.join(', ')}`);
    }
    if (policy.requireAttestation && config.attestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (policy.requireZeroization && config.zeroization === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'zeroization is required');
    }
    if (typeof config.memoryLimitBytes === 'number' && config.memoryLimitBytes > policy.sandboxMemoryLimitBytes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `memory limit ${config.memoryLimitBytes} bytes exceeds maximum ${policy.sandboxMemoryLimitBytes} bytes`);
    }
  }

  _validateEncryptedSearchRouting(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.encryptedSearchRouting, ...(tenantPolicy.encryptedSearchRouting || {}) };
    if (typeof config.keywordsPerQuery === 'number' && config.keywordsPerQuery > policy.maxKeywordsPerQuery) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `keywords per query ${config.keywordsPerQuery} exceeds maximum ${policy.maxKeywordsPerQuery}`);
    }
    if (typeof config.indexTraversalDepth === 'number' && config.indexTraversalDepth > policy.maxIndexTraversalDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `index traversal depth ${config.indexTraversalDepth} exceeds maximum ${policy.maxIndexTraversalDepth}`);
    }
    if (typeof config.blindingCurve === 'string' && !policy.allowedBlindingCurves.includes(config.blindingCurve)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `blinding curve ${config.blindingCurve} is not permitted; allowed: ${policy.allowedBlindingCurves.join(', ')}`);
    }
    if (policy.requireSubmitterAttestation && config.submitterAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'submitter attestation is required');
    }
    if (policy.requireIndexNodeAttestation && config.indexNodeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'index node attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.verificationQuorum === 'number' && config.verificationQuorum < policy.minVerificationQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `verification quorum ${config.verificationQuorum} below minimum ${policy.minVerificationQuorum}`);
    }
    if (typeof config.isolateLowQuorumIndexNodes === 'boolean' && policy.isolateLowQuorumIndexNodes && !config.isolateLowQuorumIndexNodes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'isolate low quorum index nodes must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqIdentityAccumulator(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqIdentityAccumulator, ...(tenantPolicy.pqIdentityAccumulator || {}) };
    if (typeof config.treeDepth === 'number' && config.treeDepth > policy.maxTreeDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `tree depth ${config.treeDepth} exceeds maximum ${policy.maxTreeDepth}`);
    }
    if (typeof config.membershipProofSystem === 'string' && !policy.allowedMembershipProofSystems.includes(config.membershipProofSystem)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `membership proof system ${config.membershipProofSystem} is not permitted; allowed: ${policy.allowedMembershipProofSystems.join(', ')}`);
    }
    if (typeof config.updateEpochSeconds === 'number' && config.updateEpochSeconds < policy.mandatoryUpdateEpochSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `update epoch ${config.updateEpochSeconds}s below mandatory minimum ${policy.mandatoryUpdateEpochSeconds}s`);
    }
    if (policy.requireRootUpdateAttestation && config.rootUpdateAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'root update attestation is required');
    }
    if (policy.requireMembershipProofAttestation && config.membershipProofAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'membership proof attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedMembershipPeers === 'boolean' && policy.banMalformedMembershipPeers && !config.banMalformedMembershipPeers) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed membership peers must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqcVestingLocks(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqcVestingLocks, ...(tenantPolicy.pqcVestingLocks || {}) };
    if (typeof config.vestingEpochSeconds === 'number' && config.vestingEpochSeconds < policy.minVestingEpochSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `vesting epoch ${config.vestingEpochSeconds}s below minimum ${policy.minVestingEpochSeconds}s`);
    }
    if (typeof config.releaseSignatureQuorum === 'number' && config.releaseSignatureQuorum < policy.minReleaseSignatureQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `release signature quorum ${config.releaseSignatureQuorum} below minimum ${policy.minReleaseSignatureQuorum}`);
    }
    if (typeof config.assetValue === 'number' && config.assetValue > policy.maxAssetValueCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `asset value ${config.assetValue} exceeds maximum cap ${policy.maxAssetValueCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireClaimantAttestation && config.claimantAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'claimant attestation is required');
    }
    if (policy.requireCommitteeRelayAttestation && config.committeeRelayAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'committee relay attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banExpiredOrDuplicateClaims === 'boolean' && policy.banExpiredOrDuplicateClaims && !config.banExpiredOrDuplicateClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban expired or duplicate claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqcCrossChainGovernance(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqcCrossChainGovernance, ...(tenantPolicy.pqcCrossChainGovernance || {}) };
    if (typeof config.platformVotingQuorum === 'number' && config.platformVotingQuorum < policy.minPlatformVotingQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `platform voting quorum ${config.platformVotingQuorum} below minimum ${policy.minPlatformVotingQuorum}`);
    }
    if (typeof config.concurrentProposals === 'number' && config.concurrentProposals > policy.maxConcurrentProposals) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `concurrent proposals ${config.concurrentProposals} exceeds maximum ${policy.maxConcurrentProposals}`);
    }
    if (typeof config.proposalExecutionWindowSeconds === 'number' && config.proposalExecutionWindowSeconds > policy.maxProposalExecutionWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `proposal execution window ${config.proposalExecutionWindowSeconds}s exceeds maximum ${policy.maxProposalExecutionWindowSeconds}s`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireProposalBroadcasterAttestation && config.proposalBroadcasterAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'proposal broadcaster attestation is required');
    }
    if (policy.requireVerifierRelayAttestation && config.verifierRelayAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'verifier relay attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderVotes === 'boolean' && policy.banMalformedOrOutOfOrderVotes && !config.banMalformedOrOutOfOrderVotes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order votes must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqcHomomorphicIdentityBridge(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqcHomomorphicIdentityBridge, ...(tenantPolicy.pqcHomomorphicIdentityBridge || {}) };
    if (typeof config.crossChainQuorum === 'number' && config.crossChainQuorum < policy.minCrossChainQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `cross-chain quorum ${config.crossChainQuorum} below minimum ${policy.minCrossChainQuorum}`);
    }
    if (typeof config.homomorphicMatrixDepth === 'number' && config.homomorphicMatrixDepth > policy.maxHomomorphicMatrixDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `homomorphic matrix depth ${config.homomorphicMatrixDepth} exceeds maximum ${policy.maxHomomorphicMatrixDepth}`);
    }
    if (typeof config.identityProofWindowSeconds === 'number' && config.identityProofWindowSeconds > policy.maxIdentityProofWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `identity proof window ${config.identityProofWindowSeconds}s exceeds maximum ${policy.maxIdentityProofWindowSeconds}s`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireRouterAttestation && config.routerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'router attestation is required');
    }
    if (policy.requireCommitteeVerifierAttestation && config.committeeVerifierAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'committee verifier attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderProofs === 'boolean' && policy.banMalformedOrOutOfOrderProofs && !config.banMalformedOrOutOfOrderProofs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order proofs must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqIdentityRevocation(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqIdentityRevocation, ...(tenantPolicy.pqIdentityRevocation || {}) };
    if (typeof config.revocationCommitteeQuorum === 'number' && config.revocationCommitteeQuorum < policy.minRevocationCommitteeQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `revocation committee quorum ${config.revocationCommitteeQuorum} below minimum ${policy.minRevocationCommitteeQuorum}`);
    }
    if (typeof config.revocationListCapacity === 'number' && config.revocationListCapacity > policy.maxRevocationListCapacity) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `revocation list capacity ${config.revocationListCapacity} exceeds maximum ${policy.maxRevocationListCapacity}`);
    }
    if (typeof config.proofExpirationSeconds === 'number' && config.proofExpirationSeconds > policy.maxProofExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `proof expiration ${config.proofExpirationSeconds}s exceeds maximum ${policy.maxProofExpirationSeconds}s`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requirePublisherAttestation && config.publisherAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'publisher attestation is required');
    }
    if (policy.requireVerifierAttestation && config.verifierAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'verifier attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedNonMembershipProofs === 'boolean' && policy.banMalformedNonMembershipProofs && !config.banMalformedNonMembershipProofs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed non-membership proofs must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqTimeLockedMatrix(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqTimeLockedMatrix, ...(tenantPolicy.pqTimeLockedMatrix || {}) };
    if (typeof config.timeDelaySeconds === 'number' && config.timeDelaySeconds < policy.minTimeDelaySeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `time delay ${config.timeDelaySeconds}s below minimum ${policy.minTimeDelaySeconds}s`);
    }
    if (typeof config.committeeQuorum === 'number' && config.committeeQuorum < policy.minCommitteeQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `committee quorum ${config.committeeQuorum} below minimum ${policy.minCommitteeQuorum}`);
    }
    if (typeof config.payloadBytes === 'number' && config.payloadBytes > policy.maxPayloadBytes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `payload bytes ${config.payloadBytes} exceeds maximum ${policy.maxPayloadBytes}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireSubmitterAttestation && config.submitterAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'submitter attestation is required');
    }
    if (policy.requireVerifierRelayAttestation && config.verifierRelayAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'verifier relay attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banPrematureOrMalformedProofs === 'boolean' && policy.banPrematureOrMalformedProofs && !config.banPrematureOrMalformedProofs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban premature or malformed proofs must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqBlindOptionPools(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqBlindOptionPools, ...(tenantPolicy.pqBlindOptionPools || {}) };
    if (typeof config.collateralRatio === 'number' && config.collateralRatio < policy.minCollateralRatio) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `collateral ratio ${config.collateralRatio}% below minimum ${policy.minCollateralRatio}%`);
    }
    if (typeof config.executionSignatureQuorum === 'number' && config.executionSignatureQuorum < policy.minExecutionSignatureQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `execution signature quorum ${config.executionSignatureQuorum} below minimum ${policy.minExecutionSignatureQuorum}`);
    }
    if (typeof config.contractLifetimeSeconds === 'number' && config.contractLifetimeSeconds > policy.maxContractLifetimeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `contract lifetime ${config.contractLifetimeSeconds}s exceeds maximum ${policy.maxContractLifetimeSeconds}s`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireInitializerAttestation && config.initializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrSubCollateralProofs === 'boolean' && policy.banMalformedOrSubCollateralProofs && !config.banMalformedOrSubCollateralProofs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or sub-collateral proofs must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqPredictionMarkets(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqPredictionMarkets, ...(tenantPolicy.pqPredictionMarkets || {}) };
    if (typeof config.reporterQuorum === 'number' && config.reporterQuorum < policy.minReporterQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `reporter quorum ${config.reporterQuorum} below minimum ${policy.minReporterQuorum}`);
    }
    if (typeof config.disputeResolutionEpochs === 'number' && config.disputeResolutionEpochs > policy.maxDisputeResolutionEpochs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `dispute resolution epochs ${config.disputeResolutionEpochs} exceeds maximum ${policy.maxDisputeResolutionEpochs}`);
    }
    if (typeof config.contractLifetimeSeconds === 'number' && config.contractLifetimeSeconds > policy.maxContractLifetimeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `contract lifetime ${config.contractLifetimeSeconds}s exceeds maximum ${policy.maxContractLifetimeSeconds}s`);
    }
    if (typeof config.assetWeightCap === 'number' && config.assetWeightCap > policy.maxAssetWeightCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `asset weight cap ${config.assetWeightCap} exceeds maximum ${policy.maxAssetWeightCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireMarketInitializerAttestation && config.marketInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'market initializer attestation is required');
    }
    if (policy.requireReporterRelayAttestation && config.reporterRelayAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'reporter relay attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderResolutionClaims === 'boolean' && policy.banMalformedOrOutOfOrderResolutionClaims && !config.banMalformedOrOutOfOrderResolutionClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order resolution claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqFractionalCustody(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqFractionalCustody, ...(tenantPolicy.pqFractionalCustody || {}) };
    if (typeof config.custodianQuorum === 'number' && config.custodianQuorum < policy.minCustodianQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `custodian quorum ${config.custodianQuorum} below minimum ${policy.minCustodianQuorum}`);
    }
    if (typeof config.fractionalBits === 'number' && config.fractionalBits > policy.maxFractionalBits) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `fractional bits ${config.fractionalBits} exceeds maximum ${policy.maxFractionalBits}`);
    }
    if (typeof config.assetCustodyCap === 'number' && config.assetCustodyCap > policy.maxAssetCustodyCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `asset custody cap ${config.assetCustodyCap} exceeds maximum ${policy.maxAssetCustodyCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireClaimantAttestation && config.claimantAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'claimant attestation is required');
    }
    if (policy.requireCustodianRelayAttestation && config.custodianRelayAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'custodian relay attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderCustodyClaims === 'boolean' && policy.banMalformedOrOutOfOrderCustodyClaims && !config.banMalformedOrOutOfOrderCustodyClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order custody claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqLendingPools(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqLendingPools, ...(tenantPolicy.pqLendingPools || {}) };
    if (typeof config.ltvRatio === 'number' && config.ltvRatio < policy.minLtvRatio) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `LTV ratio ${config.ltvRatio}% below minimum ${policy.minLtvRatio}%`);
    }
    if (typeof config.liquidationSignatureQuorum === 'number' && config.liquidationSignatureQuorum < policy.minLiquidationSignatureQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `liquidation signature quorum ${config.liquidationSignatureQuorum} below minimum ${policy.minLiquidationSignatureQuorum}`);
    }
    if (typeof config.borrowValueCap === 'number' && config.borrowValueCap > policy.maxBorrowValueCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `borrow value cap ${config.borrowValueCap} exceeds maximum ${policy.maxBorrowValueCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireBorrowerAttestation && config.borrowerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'borrower attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrSubSolvencyClaims === 'boolean' && policy.banMalformedOrSubSolvencyClaims && !config.banMalformedOrSubSolvencyClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or sub-solvency claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqInsuranceUnderwriting(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqInsuranceUnderwriting, ...(tenantPolicy.pqInsuranceUnderwriting || {}) };
    if (typeof config.reserveRatio === 'number' && config.reserveRatio < policy.minReserveRatio) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `reserve ratio ${config.reserveRatio}% below minimum ${policy.minReserveRatio}%`);
    }
    if (typeof config.claimQuorum === 'number' && config.claimQuorum < policy.minClaimQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `claim quorum ${config.claimQuorum} below minimum ${policy.minClaimQuorum}`);
    }
    if (typeof config.poolRiskExposureCap === 'number' && config.poolRiskExposureCap > policy.maxPoolRiskExposureCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pool risk exposure cap ${config.poolRiskExposureCap} exceeds maximum ${policy.maxPoolRiskExposureCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireCoverageInitiatorAttestation && config.coverageInitiatorAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'coverage initiator attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderClaimAssertions === 'boolean' && policy.banMalformedOrOutOfOrderClaimAssertions && !config.banMalformedOrOutOfOrderClaimAssertions) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order claim assertions must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSupplyChainEscrow(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSupplyChainEscrow, ...(tenantPolicy.pqSupplyChainEscrow || {}) };
    if (typeof config.orderMatchingQuorum === 'number' && config.orderMatchingQuorum < policy.minOrderMatchingQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `order matching quorum ${config.orderMatchingQuorum} below minimum ${policy.minOrderMatchingQuorum}`);
    }
    if (typeof config.procurementDeliveryEpochs === 'number' && config.procurementDeliveryEpochs > policy.maxProcurementDeliveryEpochs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `procurement delivery epochs ${config.procurementDeliveryEpochs} exceeds maximum ${policy.maxProcurementDeliveryEpochs}`);
    }
    if (typeof config.escrowFundingCap === 'number' && config.escrowFundingCap > policy.maxEscrowFundingCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `escrow funding cap ${config.escrowFundingCap} exceeds maximum ${policy.maxEscrowFundingCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireProcurementInitiatorAttestation && config.procurementInitiatorAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'procurement initiator attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderDeliveryAssertions === 'boolean' && policy.banMalformedOrOutOfOrderDeliveryAssertions && !config.banMalformedOrOutOfOrderDeliveryAssertions) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order delivery assertions must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqRealEstateTokenization(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqRealEstateTokenization, ...(tenantPolicy.pqRealEstateTokenization || {}) };
    if (typeof config.coSignerQuorum === 'number' && config.coSignerQuorum < policy.minCoSignerQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `co-signer quorum ${config.coSignerQuorum} below minimum ${policy.minCoSignerQuorum}`);
    }
    if (typeof config.legalDisputeSeconds === 'number' && config.legalDisputeSeconds > policy.maxLegalDisputeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `legal dispute seconds ${config.legalDisputeSeconds} exceeds maximum ${policy.maxLegalDisputeSeconds}`);
    }
    if (typeof config.assetValuationCap === 'number' && config.assetValuationCap > policy.maxAssetValuationCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `asset valuation cap ${config.assetValuationCap} exceeds maximum ${policy.maxAssetValuationCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireAssetInitializerAttestation && config.assetInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'asset initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderTitleDeedAssertions === 'boolean' && policy.banMalformedOrOutOfOrderTitleDeedAssertions && !config.banMalformedOrOutOfOrderTitleDeedAssertions) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order title deed assertions must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqCarbonTokenization(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqCarbonTokenization, ...(tenantPolicy.pqCarbonTokenization || {}) };
    if (typeof config.retirementQuorum === 'number' && config.retirementQuorum < policy.minRetirementQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `retirement quorum ${config.retirementQuorum} below minimum ${policy.minRetirementQuorum}`);
    }
    if (typeof config.vintageAgeSeconds === 'number' && config.vintageAgeSeconds > policy.maxVintageAgeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `vintage age seconds ${config.vintageAgeSeconds} exceeds maximum ${policy.maxVintageAgeSeconds}`);
    }
    if (typeof config.carbonTonnageCap === 'number' && config.carbonTonnageCap > policy.maxCarbonTonnageCap) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `carbon tonnage cap ${config.carbonTonnageCap} exceeds maximum ${policy.maxCarbonTonnageCap}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireAssetInitializerAttestation && config.assetInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'asset initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderRetirementAssertions === 'boolean' && policy.banMalformedOrOutOfOrderRetirementAssertions && !config.banMalformedOrOutOfOrderRetirementAssertions) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order retirement assertions must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqIdentityGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqIdentityGating, ...(tenantPolicy.pqIdentityGating || {}) };
    if (typeof config.attestationQuorum === 'number' && config.attestationQuorum < policy.minAttestationQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation quorum ${config.attestationQuorum} below minimum ${policy.minAttestationQuorum}`);
    }
    if (typeof config.attestationContractLifetimeSeconds === 'number' && config.attestationContractLifetimeSeconds > policy.maxAttestationContractLifetimeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation contract lifetime seconds ${config.attestationContractLifetimeSeconds} exceeds maximum ${policy.maxAttestationContractLifetimeSeconds}`);
    }
    if (typeof config.credentialDepth === 'number' && config.credentialDepth > policy.maxCredentialDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `credential depth ${config.credentialDepth} exceeds maximum ${policy.maxCredentialDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireIdentityInitializerAttestation && config.identityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'identity initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderIdentityClaims === 'boolean' && policy.banMalformedOrOutOfOrderIdentityClaims && !config.banMalformedOrOutOfOrderIdentityClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order identity claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqHealthDataGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqHealthDataGating, ...(tenantPolicy.pqHealthDataGating || {}) };
    if (typeof config.verificationQuorum === 'number' && config.verificationQuorum < policy.minVerificationQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `verification quorum ${config.verificationQuorum} below minimum ${policy.minVerificationQuorum}`);
    }
    if (typeof config.recordExpirationLifetimeSeconds === 'number' && config.recordExpirationLifetimeSeconds > policy.maxRecordExpirationLifetimeSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `record expiration lifetime seconds ${config.recordExpirationLifetimeSeconds} exceeds maximum ${policy.maxRecordExpirationLifetimeSeconds}`);
    }
    if (typeof config.diagnosticObservationDepth === 'number' && config.diagnosticObservationDepth > policy.maxDiagnosticObservationDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `diagnostic observation depth ${config.diagnosticObservationDepth} exceeds maximum ${policy.maxDiagnosticObservationDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireRecordInitializerAttestation && config.recordInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'record initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderHealthClaims === 'boolean' && policy.banMalformedOrOutOfOrderHealthClaims && !config.banMalformedOrOutOfOrderHealthClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order health claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqEducationGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqEducationGating, ...(tenantPolicy.pqEducationGating || {}) };
    if (typeof config.accreditationQuorum === 'number' && config.accreditationQuorum < policy.minAccreditationQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `accreditation quorum ${config.accreditationQuorum} below minimum ${policy.minAccreditationQuorum}`);
    }
    if (typeof config.transcriptExpirationSeconds === 'number' && config.transcriptExpirationSeconds > policy.maxTranscriptExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `transcript expiration seconds ${config.transcriptExpirationSeconds} exceeds maximum ${policy.maxTranscriptExpirationSeconds}`);
    }
    if (typeof config.academicCredentialDepth === 'number' && config.academicCredentialDepth > policy.maxAcademicCredentialDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `academic credential depth ${config.academicCredentialDepth} exceeds maximum ${policy.maxAcademicCredentialDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireInstitutionInitializerAttestation && config.institutionInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'institution initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderCredentialClaims === 'boolean' && policy.banMalformedOrOutOfOrderCredentialClaims && !config.banMalformedOrOutOfOrderCredentialClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order credential claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqPatentGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqPatentGating, ...(tenantPolicy.pqPatentGating || {}) };
    if (typeof config.licensingQuorum === 'number' && config.licensingQuorum < policy.minLicensingQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `licensing quorum ${config.licensingQuorum} below minimum ${policy.minLicensingQuorum}`);
    }
    if (typeof config.patentExpirationSeconds === 'number' && config.patentExpirationSeconds > policy.maxPatentExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `patent expiration seconds ${config.patentExpirationSeconds} exceeds maximum ${policy.maxPatentExpirationSeconds}`);
    }
    if (typeof config.claimScopeDepth === 'number' && config.claimScopeDepth > policy.maxClaimScopeDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `claim scope depth ${config.claimScopeDepth} exceeds maximum ${policy.maxClaimScopeDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requirePatentOfficeInitializerAttestation && config.patentOfficeInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'patent office initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderPatentClaims === 'boolean' && policy.banMalformedOrOutOfOrderPatentClaims && !config.banMalformedOrOutOfOrderPatentClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order patent claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqEnergyGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqEnergyGating, ...(tenantPolicy.pqEnergyGating || {}) };
    if (typeof config.gridOperatorQuorum === 'number' && config.gridOperatorQuorum < policy.minGridOperatorQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `grid operator quorum ${config.gridOperatorQuorum} below minimum ${policy.minGridOperatorQuorum}`);
    }
    if (typeof config.certificateExpirationSeconds === 'number' && config.certificateExpirationSeconds > policy.maxCertificateExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `certificate expiration seconds ${config.certificateExpirationSeconds} exceeds maximum ${policy.maxCertificateExpirationSeconds}`);
    }
    if (typeof config.productionMetricDepth === 'number' && config.productionMetricDepth > policy.maxProductionMetricDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `production metric depth ${config.productionMetricDepth} exceeds maximum ${policy.maxProductionMetricDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireGridOperatorInitializerAttestation && config.gridOperatorInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'grid operator initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderEnergyClaims === 'boolean' && policy.banMalformedOrOutOfOrderEnergyClaims && !config.banMalformedOrOutOfOrderEnergyClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order energy claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSupplyChainGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSupplyChainGating, ...(tenantPolicy.pqSupplyChainGating || {}) };
    if (typeof config.supplierCheckpointQuorum === 'number' && config.supplierCheckpointQuorum < policy.minSupplierCheckpointQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `supplier checkpoint quorum ${config.supplierCheckpointQuorum} below minimum ${policy.minSupplierCheckpointQuorum}`);
    }
    if (typeof config.transitExpirationSeconds === 'number' && config.transitExpirationSeconds > policy.maxTransitExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `transit expiration seconds ${config.transitExpirationSeconds} exceeds maximum ${policy.maxTransitExpirationSeconds}`);
    }
    if (typeof config.componentLineageDepth === 'number' && config.componentLineageDepth > policy.maxComponentLineageDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `component lineage depth ${config.componentLineageDepth} exceeds maximum ${policy.maxComponentLineageDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireFactoryEndpointInitializerAttestation && config.factoryEndpointInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'factory endpoint initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderProvenanceClaims === 'boolean' && policy.banMalformedOrOutOfOrderProvenanceClaims && !config.banMalformedOrOutOfOrderProvenanceClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order provenance claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqBiometricGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqBiometricGating, ...(tenantPolicy.pqBiometricGating || {}) };
    if (typeof config.biometricAuthorityQuorum === 'number' && config.biometricAuthorityQuorum < policy.minBiometricAuthorityQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `biometric authority quorum ${config.biometricAuthorityQuorum} below minimum ${policy.minBiometricAuthorityQuorum}`);
    }
    if (typeof config.templateExpirationSeconds === 'number' && config.templateExpirationSeconds > policy.maxTemplateExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `template expiration seconds ${config.templateExpirationSeconds} exceeds maximum ${policy.maxTemplateExpirationSeconds}`);
    }
    if (typeof config.livenessMetricDepth === 'number' && config.livenessMetricDepth > policy.maxLivenessMetricDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `liveness metric depth ${config.livenessMetricDepth} exceeds maximum ${policy.maxLivenessMetricDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireBiometricAuthorityInitializerAttestation && config.biometricAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'biometric authority initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderBiometricClaims === 'boolean' && policy.banMalformedOrOutOfOrderBiometricClaims && !config.banMalformedOrOutOfOrderBiometricClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order biometric claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqDerivativeGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqDerivativeGating, ...(tenantPolicy.pqDerivativeGating || {}) };
    if (typeof config.clearingHouseQuorum === 'number' && config.clearingHouseQuorum < policy.minClearingHouseQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `clearing house quorum ${config.clearingHouseQuorum} below minimum ${policy.minClearingHouseQuorum}`);
    }
    if (typeof config.contractExpirationSeconds === 'number' && config.contractExpirationSeconds > policy.maxContractExpirationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `contract expiration seconds ${config.contractExpirationSeconds} exceeds maximum ${policy.maxContractExpirationSeconds}`);
    }
    if (typeof config.riskMetricDepth === 'number' && config.riskMetricDepth > policy.maxRiskMetricDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `risk metric depth ${config.riskMetricDepth} exceeds maximum ${policy.maxRiskMetricDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireClearingHouseInitializerAttestation && config.clearingHouseInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing house initializer attestation is required');
    }
    if (policy.requireRiskCommitteeAttestation && config.riskCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'risk committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderDerivativeClaims === 'boolean' && policy.banMalformedOrOutOfOrderDerivativeClaims && !config.banMalformedOrOutOfOrderDerivativeClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order derivative claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqClinicalTrialGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqClinicalTrialGating, ...(tenantPolicy.pqClinicalTrialGating || {}) };
    if (typeof config.trialOversightQuorum === 'number' && config.trialOversightQuorum < policy.minTrialOversightQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `trial oversight quorum ${config.trialOversightQuorum} below minimum ${policy.minTrialOversightQuorum}`);
    }
    if (typeof config.trialDurationSeconds === 'number' && config.trialDurationSeconds > policy.maxTrialDurationSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `trial duration seconds ${config.trialDurationSeconds} exceeds maximum ${policy.maxTrialDurationSeconds}`);
    }
    if (typeof config.cohortMetricDepth === 'number' && config.cohortMetricDepth > policy.maxCohortMetricDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `cohort metric depth ${config.cohortMetricDepth} exceeds maximum ${policy.maxCohortMetricDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireTrialOversightInitializerAttestation && config.trialOversightInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'trial oversight initializer attestation is required');
    }
    if (policy.requireClearingCommitteeAttestation && config.clearingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'clearing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderTrialClaims === 'boolean' && policy.banMalformedOrOutOfOrderTrialClaims && !config.banMalformedOrOutOfOrderTrialClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order trial claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSortitionGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSortitionGating, ...(tenantPolicy.pqSortitionGating || {}) };
    if (typeof config.sortitionQuorum === 'number' && config.sortitionQuorum < policy.minSortitionQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sortition quorum ${config.sortitionQuorum} below minimum ${policy.minSortitionQuorum}`);
    }
    if (typeof config.sortitionEpochSeconds === 'number' && config.sortitionEpochSeconds > policy.maxSortitionEpochSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sortition epoch seconds ${config.sortitionEpochSeconds} exceeds maximum ${policy.maxSortitionEpochSeconds}`);
    }
    if (typeof config.entropyDepth === 'number' && config.entropyDepth > policy.maxEntropyDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `entropy depth ${config.entropyDepth} exceeds maximum ${policy.maxEntropyDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireSortitionAuthorityInitializerAttestation && config.sortitionAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'sortition authority initializer attestation is required');
    }
    if (policy.requireAuditCommitteeAttestation && config.auditCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'audit committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderSortitionClaims === 'boolean' && policy.banMalformedOrOutOfOrderSortitionClaims && !config.banMalformedOrOutOfOrderSortitionClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order sortition claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqLogisticsGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqLogisticsGating, ...(tenantPolicy.pqLogisticsGating || {}) };
    if (typeof config.customsQuorum === 'number' && config.customsQuorum < policy.minCustomsQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `customs quorum ${config.customsQuorum} below minimum ${policy.minCustomsQuorum}`);
    }
    if (typeof config.transitWindowSeconds === 'number' && config.transitWindowSeconds > policy.maxTransitWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `transit window seconds ${config.transitWindowSeconds} exceeds maximum ${policy.maxTransitWindowSeconds}`);
    }
    if (typeof config.manifestDepth === 'number' && config.manifestDepth > policy.maxManifestDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `manifest depth ${config.manifestDepth} exceeds maximum ${policy.maxManifestDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireCustomsAuthorityInitializerAttestation && config.customsAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'customs authority initializer attestation is required');
    }
    if (policy.requireTradeCorridorCommitteeAttestation && config.tradeCorridorCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'trade corridor committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderManifestClaims === 'boolean' && policy.banMalformedOrOutOfOrderManifestClaims && !config.banMalformedOrOutOfOrderManifestClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order manifest claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqTrainingGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqTrainingGating, ...(tenantPolicy.pqTrainingGating || {}) };
    if (typeof config.trainingOversightQuorum === 'number' && config.trainingOversightQuorum < policy.minTrainingOversightQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `training oversight quorum ${config.trainingOversightQuorum} below minimum ${policy.minTrainingOversightQuorum}`);
    }
    if (typeof config.trainingWindowSeconds === 'number' && config.trainingWindowSeconds > policy.maxTrainingWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `training window seconds ${config.trainingWindowSeconds} exceeds maximum ${policy.maxTrainingWindowSeconds}`);
    }
    if (typeof config.provenanceDepth === 'number' && config.provenanceDepth > policy.maxProvenanceDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `provenance depth ${config.provenanceDepth} exceeds maximum ${policy.maxProvenanceDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireTrainingAuthorityInitializerAttestation && config.trainingAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'training authority initializer attestation is required');
    }
    if (policy.requireModelAuditCommitteeAttestation && config.modelAuditCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'model audit committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderTrainingClaims === 'boolean' && policy.banMalformedOrOutOfOrderTrainingClaims && !config.banMalformedOrOutOfOrderTrainingClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order training claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqResearchGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqResearchGating, ...(tenantPolicy.pqResearchGating || {}) };
    if (typeof config.peerReviewQuorum === 'number' && config.peerReviewQuorum < policy.minPeerReviewQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `peer review quorum ${config.peerReviewQuorum} below minimum ${policy.minPeerReviewQuorum}`);
    }
    if (typeof config.replicationWindowSeconds === 'number' && config.replicationWindowSeconds > policy.maxReplicationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `replication window seconds ${config.replicationWindowSeconds} exceeds maximum ${policy.maxReplicationWindowSeconds}`);
    }
    if (typeof config.citationDepth === 'number' && config.citationDepth > policy.maxCitationDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `citation depth ${config.citationDepth} exceeds maximum ${policy.maxCitationDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireResearchAuthorityInitializerAttestation && config.researchAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'research authority initializer attestation is required');
    }
    if (policy.requireIntegrityCommitteeAttestation && config.integrityCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'integrity committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderReplicationClaims === 'boolean' && policy.banMalformedOrOutOfOrderReplicationClaims && !config.banMalformedOrOutOfOrderReplicationClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order replication claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqTreasuryGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqTreasuryGating, ...(tenantPolicy.pqTreasuryGating || {}) };
    if (typeof config.proposalQuorum === 'number' && config.proposalQuorum < policy.minProposalQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `proposal quorum ${config.proposalQuorum} below minimum ${policy.minProposalQuorum}`);
    }
    if (typeof config.proposalWindowSeconds === 'number' && config.proposalWindowSeconds > policy.maxProposalWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `proposal window seconds ${config.proposalWindowSeconds} exceeds maximum ${policy.maxProposalWindowSeconds}`);
    }
    if (typeof config.allocationDepth === 'number' && config.allocationDepth > policy.maxAllocationDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `allocation depth ${config.allocationDepth} exceeds maximum ${policy.maxAllocationDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireGovernanceAuthorityInitializerAttestation && config.governanceAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'governance authority initializer attestation is required');
    }
    if (policy.requireTreasuryOversightCommitteeAttestation && config.treasuryOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'treasury oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderProposalClaims === 'boolean' && policy.banMalformedOrOutOfOrderProposalClaims && !config.banMalformedOrOutOfOrderProposalClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order proposal claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqTelecomGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqTelecomGating, ...(tenantPolicy.pqTelecomGating || {}) };
    if (typeof config.telecomPeeringQuorum === 'number' && config.telecomPeeringQuorum < policy.minTelecomPeeringQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `telecom peering quorum ${config.telecomPeeringQuorum} below minimum ${policy.minTelecomPeeringQuorum}`);
    }
    if (typeof config.allocationWindowSeconds === 'number' && config.allocationWindowSeconds > policy.maxAllocationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `allocation window seconds ${config.allocationWindowSeconds} exceeds maximum ${policy.maxAllocationWindowSeconds}`);
    }
    if (typeof config.networkRoutingDepth === 'number' && config.networkRoutingDepth > policy.maxNetworkRoutingDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `network routing depth ${config.networkRoutingDepth} exceeds maximum ${policy.maxNetworkRoutingDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireCarrierEndpointInitializerAttestation && config.carrierEndpointInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'carrier endpoint initializer attestation is required');
    }
    if (policy.requireRoutingCommitteeAttestation && config.routingCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'routing committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderTelecomClaims === 'boolean' && policy.banMalformedOrOutOfOrderTelecomClaims && !config.banMalformedOrOutOfOrderTelecomClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order telecom claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqInsuranceGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqInsuranceGating, ...(tenantPolicy.pqInsuranceGating || {}) };
    if (typeof config.claimsAuditQuorum === 'number' && config.claimsAuditQuorum < policy.minClaimsAuditQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `claims audit quorum ${config.claimsAuditQuorum} below minimum ${policy.minClaimsAuditQuorum}`);
    }
    if (typeof config.claimWindowSeconds === 'number' && config.claimWindowSeconds > policy.maxClaimWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `claim window seconds ${config.claimWindowSeconds} exceeds maximum ${policy.maxClaimWindowSeconds}`);
    }
    if (typeof config.billingSequenceDepth === 'number' && config.billingSequenceDepth > policy.maxBillingSequenceDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `billing sequence depth ${config.billingSequenceDepth} exceeds maximum ${policy.maxBillingSequenceDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireInsuranceAuthorityInitializerAttestation && config.insuranceAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'insurance authority initializer attestation is required');
    }
    if (policy.requireActuarialCommitteeAttestation && config.actuarialCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'actuarial committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderClaims === 'boolean' && policy.banMalformedOrOutOfOrderClaims && !config.banMalformedOrOutOfOrderClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSpaceGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSpaceGating, ...(tenantPolicy.pqSpaceGating || {}) };
    if (typeof config.orbitalSlotQuorum === 'number' && config.orbitalSlotQuorum < policy.minOrbitalSlotQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `orbital slot quorum ${config.orbitalSlotQuorum} below minimum ${policy.minOrbitalSlotQuorum}`);
    }
    if (typeof config.slotAllocationWindowSeconds === 'number' && config.slotAllocationWindowSeconds > policy.maxSlotAllocationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `slot allocation window seconds ${config.slotAllocationWindowSeconds} exceeds maximum ${policy.maxSlotAllocationWindowSeconds}`);
    }
    if (typeof config.telemetryChainDepth === 'number' && config.telemetryChainDepth > policy.maxTelemetryChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `telemetry chain depth ${config.telemetryChainDepth} exceeds maximum ${policy.maxTelemetryChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireSpaceAuthorityInitializerAttestation && config.spaceAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'space authority initializer attestation is required');
    }
    if (policy.requireOrbitalOversightCommitteeAttestation && config.orbitalOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'orbital oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderOrbitalClaims === 'boolean' && policy.banMalformedOrOutOfOrderOrbitalClaims && !config.banMalformedOrOutOfOrderOrbitalClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order orbital claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqWaterGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqWaterGating, ...(tenantPolicy.pqWaterGating || {}) };
    if (typeof config.watershedQuorum === 'number' && config.watershedQuorum < policy.minWatershedQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `watershed quorum ${config.watershedQuorum} below minimum ${policy.minWatershedQuorum}`);
    }
    if (typeof config.allocationWindowSeconds === 'number' && config.allocationWindowSeconds > policy.maxAllocationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `allocation window seconds ${config.allocationWindowSeconds} exceeds maximum ${policy.maxAllocationWindowSeconds}`);
    }
    if (typeof config.flowChainDepth === 'number' && config.flowChainDepth > policy.maxFlowChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `flow chain depth ${config.flowChainDepth} exceeds maximum ${policy.maxFlowChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireWaterAuthorityInitializerAttestation && config.waterAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'water authority initializer attestation is required');
    }
    if (policy.requireWatershedOversightCommitteeAttestation && config.watershedOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'watershed oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderWaterClaims === 'boolean' && policy.banMalformedOrOutOfOrderWaterClaims && !config.banMalformedOrOutOfOrderWaterClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order water claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqNuclearGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqNuclearGating, ...(tenantPolicy.pqNuclearGating || {}) };
    if (typeof config.safeguardsQuorum === 'number' && config.safeguardsQuorum < policy.minSafeguardsQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `safeguards quorum ${config.safeguardsQuorum} below minimum ${policy.minSafeguardsQuorum}`);
    }
    if (typeof config.inspectionWindowSeconds === 'number' && config.inspectionWindowSeconds > policy.maxInspectionWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `inspection window seconds ${config.inspectionWindowSeconds} exceeds maximum ${policy.maxInspectionWindowSeconds}`);
    }
    if (typeof config.telemetryChainDepth === 'number' && config.telemetryChainDepth > policy.maxTelemetryChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `telemetry chain depth ${config.telemetryChainDepth} exceeds maximum ${policy.maxTelemetryChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireSafeguardsAuthorityInitializerAttestation && config.safeguardsAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'safeguards authority initializer attestation is required');
    }
    if (policy.requireNuclearOversightCommitteeAttestation && config.nuclearOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'nuclear oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderSafeguardsClaims === 'boolean' && policy.banMalformedOrOutOfOrderSafeguardsClaims && !config.banMalformedOrOutOfOrderSafeguardsClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order safeguards claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqWildlifeGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqWildlifeGating, ...(tenantPolicy.pqWildlifeGating || {}) };
    if (typeof config.conservationQuorum === 'number' && config.conservationQuorum < policy.minConservationQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `conservation quorum ${config.conservationQuorum} below minimum ${policy.minConservationQuorum}`);
    }
    if (typeof config.monitoringWindowSeconds === 'number' && config.monitoringWindowSeconds > policy.maxMonitoringWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `monitoring window seconds ${config.monitoringWindowSeconds} exceeds maximum ${policy.maxMonitoringWindowSeconds}`);
    }
    if (typeof config.telemetryChainDepth === 'number' && config.telemetryChainDepth > policy.maxTelemetryChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `telemetry chain depth ${config.telemetryChainDepth} exceeds maximum ${policy.maxTelemetryChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireConservationAuthorityInitializerAttestation && config.conservationAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'conservation authority initializer attestation is required');
    }
    if (policy.requireBiodiversityOversightCommitteeAttestation && config.biodiversityOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'biodiversity oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderConservationClaims === 'boolean' && policy.banMalformedOrOutOfOrderConservationClaims && !config.banMalformedOrOutOfOrderConservationClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order conservation claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSmartGridGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSmartGridGating, ...(tenantPolicy.pqSmartGridGating || {}) };
    if (typeof config.gridOperatorQuorum === 'number' && config.gridOperatorQuorum < policy.minGridOperatorQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `grid operator quorum ${config.gridOperatorQuorum} below minimum ${policy.minGridOperatorQuorum}`);
    }
    if (typeof config.transactionWindowSeconds === 'number' && config.transactionWindowSeconds > policy.maxTransactionWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `transaction window seconds ${config.transactionWindowSeconds} exceeds maximum ${policy.maxTransactionWindowSeconds}`);
    }
    if (typeof config.consumptionChainDepth === 'number' && config.consumptionChainDepth > policy.maxConsumptionChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `consumption chain depth ${config.consumptionChainDepth} exceeds maximum ${policy.maxConsumptionChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireGridAuthorityInitializerAttestation && config.gridAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'grid authority initializer attestation is required');
    }
    if (policy.requireLoadBalanceOversightCommitteeAttestation && config.loadBalanceOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'load balance oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderMicroTransactionClaims === 'boolean' && policy.banMalformedOrOutOfOrderMicroTransactionClaims && !config.banMalformedOrOutOfOrderMicroTransactionClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order micro-transaction claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqEpidemiologyGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqEpidemiologyGating, ...(tenantPolicy.pqEpidemiologyGating || {}) };
    if (typeof config.epidemiologyQuorum === 'number' && config.epidemiologyQuorum < policy.minEpidemiologyQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `epidemiology quorum ${config.epidemiologyQuorum} below minimum ${policy.minEpidemiologyQuorum}`);
    }
    if (typeof config.surveillanceWindowSeconds === 'number' && config.surveillanceWindowSeconds > policy.maxSurveillanceWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `surveillance window seconds ${config.surveillanceWindowSeconds} exceeds maximum ${policy.maxSurveillanceWindowSeconds}`);
    }
    if (typeof config.genomicChainDepth === 'number' && config.genomicChainDepth > policy.maxGenomicChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `genomic chain depth ${config.genomicChainDepth} exceeds maximum ${policy.maxGenomicChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireWhoAuthorityInitializerAttestation && config.whoAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'WHO authority initializer attestation is required');
    }
    if (policy.requireEpidemiologyOversightCommitteeAttestation && config.epidemiologyOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'epidemiology oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderEpidemiologicalClaims === 'boolean' && policy.banMalformedOrOutOfOrderEpidemiologicalClaims && !config.banMalformedOrOutOfOrderEpidemiologicalClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order epidemiological claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqHeritageGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqHeritageGating, ...(tenantPolicy.pqHeritageGating || {}) };
    if (typeof config.authenticationQuorum === 'number' && config.authenticationQuorum < policy.minAuthenticationQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `authentication quorum ${config.authenticationQuorum} below minimum ${policy.minAuthenticationQuorum}`);
    }
    if (typeof config.authenticationWindowSeconds === 'number' && config.authenticationWindowSeconds > policy.maxAuthenticationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `authentication window seconds ${config.authenticationWindowSeconds} exceeds maximum ${policy.maxAuthenticationWindowSeconds}`);
    }
    if (typeof config.provenanceChainDepth === 'number' && config.provenanceChainDepth > policy.maxProvenanceChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `provenance chain depth ${config.provenanceChainDepth} exceeds maximum ${policy.maxProvenanceChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireUnescoAuthorityInitializerAttestation && config.unescoAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'UNESCO authority initializer attestation is required');
    }
    if (policy.requireCulturalHeritageOversightCommitteeAttestation && config.culturalHeritageOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'cultural heritage oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderAuthenticationClaims === 'boolean' && policy.banMalformedOrOutOfOrderAuthenticationClaims && !config.banMalformedOrOutOfOrderAuthenticationClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order authentication claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqFisheriesGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqFisheriesGating, ...(tenantPolicy.pqFisheriesGating || {}) };
    if (typeof config.maritimeQuorum === 'number' && config.maritimeQuorum < policy.minMaritimeQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maritime quorum ${config.maritimeQuorum} below minimum ${policy.minMaritimeQuorum}`);
    }
    if (typeof config.catchTrackingWindowSeconds === 'number' && config.catchTrackingWindowSeconds > policy.maxCatchTrackingWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `catch tracking window seconds ${config.catchTrackingWindowSeconds} exceeds maximum ${policy.maxCatchTrackingWindowSeconds}`);
    }
    if (typeof config.vesselTelemetryChainDepth === 'number' && config.vesselTelemetryChainDepth > policy.maxVesselTelemetryChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `vessel telemetry chain depth ${config.vesselTelemetryChainDepth} exceeds maximum ${policy.maxVesselTelemetryChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireRfmoAuthorityInitializerAttestation && config.rfmoAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'RFMO authority initializer attestation is required');
    }
    if (policy.requireMarineSanctuaryOversightCommitteeAttestation && config.marineSanctuaryOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'marine sanctuary oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderCatchClaims === 'boolean' && policy.banMalformedOrOutOfOrderCatchClaims && !config.banMalformedOrOutOfOrderCatchClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order catch claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSeabedGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSeabedGating, ...(tenantPolicy.pqSeabedGating || {}) };
    if (typeof config.sovereignQuorum === 'number' && config.sovereignQuorum < policy.minSovereignQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sovereign quorum ${config.sovereignQuorum} below minimum ${policy.minSovereignQuorum}`);
    }
    if (typeof config.leaseWindowSeconds === 'number' && config.leaseWindowSeconds > policy.maxLeaseWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `lease window seconds ${config.leaseWindowSeconds} exceeds maximum ${policy.maxLeaseWindowSeconds}`);
    }
    if (typeof config.extractionChainDepth === 'number' && config.extractionChainDepth > policy.maxExtractionChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `extraction chain depth ${config.extractionChainDepth} exceeds maximum ${policy.maxExtractionChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireIsaAuthorityInitializerAttestation && config.isaAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ISA authority initializer attestation is required');
    }
    if (policy.requireSeabedOversightCommitteeAttestation && config.seabedOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'seabed oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderExtractionClaims === 'boolean' && policy.banMalformedOrOutOfOrderExtractionClaims && !config.banMalformedOrOutOfOrderExtractionClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order extraction claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqPolarResearchGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqPolarResearchGating, ...(tenantPolicy.pqPolarResearchGating || {}) };
    if (typeof config.polarQuorum === 'number' && config.polarQuorum < policy.minPolarQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `polar quorum ${config.polarQuorum} below minimum ${policy.minPolarQuorum}`);
    }
    if (typeof config.dataRetentionWindowSeconds === 'number' && config.dataRetentionWindowSeconds > policy.maxDataRetentionWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `data retention window seconds ${config.dataRetentionWindowSeconds} exceeds maximum ${policy.maxDataRetentionWindowSeconds}`);
    }
    if (typeof config.researchChainDepth === 'number' && config.researchChainDepth > policy.maxResearchChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `research chain depth ${config.researchChainDepth} exceeds maximum ${policy.maxResearchChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireAntarcticTreatySecretariatInitializerAttestation && config.antarcticTreatySecretariatInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'Antarctic Treaty Secretariat initializer attestation is required');
    }
    if (policy.requirePolarResearchOversightCommitteeAttestation && config.polarResearchOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'polar research oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderResearchClaims === 'boolean' && policy.banMalformedOrOutOfOrderResearchClaims && !config.banMalformedOrOutOfOrderResearchClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order research claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqStratosphericAerosolGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqStratosphericAerosolGating, ...(tenantPolicy.pqStratosphericAerosolGating || {}) };
    if (typeof config.climateQuorum === 'number' && config.climateQuorum < policy.minClimateQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `climate quorum ${config.climateQuorum} below minimum ${policy.minClimateQuorum}`);
    }
    if (typeof config.deploymentWindowSeconds === 'number' && config.deploymentWindowSeconds > policy.maxDeploymentWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `deployment window seconds ${config.deploymentWindowSeconds} exceeds maximum ${policy.maxDeploymentWindowSeconds}`);
    }
    if (typeof config.monitoringChainDepth === 'number' && config.monitoringChainDepth > policy.maxMonitoringChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `monitoring chain depth ${config.monitoringChainDepth} exceeds maximum ${policy.maxMonitoringChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireClimateAuthorityInitializerAttestation && config.climateAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'climate authority initializer attestation is required');
    }
    if (policy.requireStratosphericOversightCommitteeAttestation && config.stratosphericOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'stratospheric oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderAerosolClaims === 'boolean' && policy.banMalformedOrOutOfOrderAerosolClaims && !config.banMalformedOrOutOfOrderAerosolClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order aerosol claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqOrbitalDebrisTrackingGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqOrbitalDebrisTrackingGating, ...(tenantPolicy.pqOrbitalDebrisTrackingGating || {}) };
    if (typeof config.orbitalQuorum === 'number' && config.orbitalQuorum < policy.minOrbitalQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `orbital quorum ${config.orbitalQuorum} below minimum ${policy.minOrbitalQuorum}`);
    }
    if (typeof config.collisionWindowSeconds === 'number' && config.collisionWindowSeconds > policy.maxCollisionWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `collision window seconds ${config.collisionWindowSeconds} exceeds maximum ${policy.maxCollisionWindowSeconds}`);
    }
    if (typeof config.trackingChainDepth === 'number' && config.trackingChainDepth > policy.maxTrackingChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `tracking chain depth ${config.trackingChainDepth} exceeds maximum ${policy.maxTrackingChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireSpaceSurveillanceAuthorityInitializerAttestation && config.spaceSurveillanceAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'space surveillance authority initializer attestation is required');
    }
    if (policy.requireOrbitalDebrisOversightCommitteeAttestation && config.orbitalDebrisOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'orbital debris oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderDebrisClaims === 'boolean' && policy.banMalformedOrOutOfOrderDebrisClaims && !config.banMalformedOrOutOfOrderDebrisClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order debris claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqGenomicPrivacyComplianceGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqGenomicPrivacyComplianceGating, ...(tenantPolicy.pqGenomicPrivacyComplianceGating || {}) };
    if (typeof config.genomicQuorum === 'number' && config.genomicQuorum < policy.minGenomicQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `genomic quorum ${config.genomicQuorum} below minimum ${policy.minGenomicQuorum}`);
    }
    if (typeof config.consentWindowSeconds === 'number' && config.consentWindowSeconds > policy.maxConsentWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `consent window seconds ${config.consentWindowSeconds} exceeds maximum ${policy.maxConsentWindowSeconds}`);
    }
    if (typeof config.complianceChainDepth === 'number' && config.complianceChainDepth > policy.maxComplianceChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `compliance chain depth ${config.complianceChainDepth} exceeds maximum ${policy.maxComplianceChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireGenomicPrivacyAuthorityInitializerAttestation && config.genomicPrivacyAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'genomic privacy authority initializer attestation is required');
    }
    if (policy.requireGenomicEthicsOversightCommitteeAttestation && config.genomicEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'genomic ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderGenomicClaims === 'boolean' && policy.banMalformedOrOutOfOrderGenomicClaims && !config.banMalformedOrOutOfOrderGenomicClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order genomic claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqQuantumSensorCalibrationGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqQuantumSensorCalibrationGating, ...(tenantPolicy.pqQuantumSensorCalibrationGating || {}) };
    if (typeof config.quantumQuorum === 'number' && config.quantumQuorum < policy.minQuantumQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `quantum quorum ${config.quantumQuorum} below minimum ${policy.minQuantumQuorum}`);
    }
    if (typeof config.calibrationWindowSeconds === 'number' && config.calibrationWindowSeconds > policy.maxCalibrationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `calibration window seconds ${config.calibrationWindowSeconds} exceeds maximum ${policy.maxCalibrationWindowSeconds}`);
    }
    if (typeof config.calibrationChainDepth === 'number' && config.calibrationChainDepth > policy.maxCalibrationChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `calibration chain depth ${config.calibrationChainDepth} exceeds maximum ${policy.maxCalibrationChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireQuantumMetrologyAuthorityInitializerAttestation && config.quantumMetrologyAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'quantum metrology authority initializer attestation is required');
    }
    if (policy.requireQuantumStandardsOversightCommitteeAttestation && config.quantumStandardsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'quantum standards oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderQuantumClaims === 'boolean' && policy.banMalformedOrOutOfOrderQuantumClaims && !config.banMalformedOrOutOfOrderQuantumClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order quantum claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqNeuralNetworkInferenceIntegrityGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqNeuralNetworkInferenceIntegrityGating, ...(tenantPolicy.pqNeuralNetworkInferenceIntegrityGating || {}) };
    if (typeof config.neuralQuorum === 'number' && config.neuralQuorum < policy.minNeuralQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `neural quorum ${config.neuralQuorum} below minimum ${policy.minNeuralQuorum}`);
    }
    if (typeof config.inferenceWindowSeconds === 'number' && config.inferenceWindowSeconds > policy.maxInferenceWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `inference window seconds ${config.inferenceWindowSeconds} exceeds maximum ${policy.maxInferenceWindowSeconds}`);
    }
    if (typeof config.inferenceChainDepth === 'number' && config.inferenceChainDepth > policy.maxInferenceChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `inference chain depth ${config.inferenceChainDepth} exceeds maximum ${policy.maxInferenceChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireNeuralNetworkAuthorityInitializerAttestation && config.neuralNetworkAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'neural network authority initializer attestation is required');
    }
    if (policy.requireNeuralEthicsOversightCommitteeAttestation && config.neuralEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'neural ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderNeuralClaims === 'boolean' && policy.banMalformedOrOutOfOrderNeuralClaims && !config.banMalformedOrOutOfOrderNeuralClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order neural claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqAutonomousVehicleFleetCoordinationGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqAutonomousVehicleFleetCoordinationGating, ...(tenantPolicy.pqAutonomousVehicleFleetCoordinationGating || {}) };
    if (typeof config.autonomousQuorum === 'number' && config.autonomousQuorum < policy.minAutonomousQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `autonomous quorum ${config.autonomousQuorum} below minimum ${policy.minAutonomousQuorum}`);
    }
    if (typeof config.coordinationWindowSeconds === 'number' && config.coordinationWindowSeconds > policy.maxCoordinationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `coordination window seconds ${config.coordinationWindowSeconds} exceeds maximum ${policy.maxCoordinationWindowSeconds}`);
    }
    if (typeof config.coordinationChainDepth === 'number' && config.coordinationChainDepth > policy.maxCoordinationChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `coordination chain depth ${config.coordinationChainDepth} exceeds maximum ${policy.maxCoordinationChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireAutonomousMobilityAuthorityInitializerAttestation && config.autonomousMobilityAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'autonomous mobility authority initializer attestation is required');
    }
    if (policy.requireAutonomousEthicsOversightCommitteeAttestation && config.autonomousEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'autonomous ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderAutonomousClaims === 'boolean' && policy.banMalformedOrOutOfOrderAutonomousClaims && !config.banMalformedOrOutOfOrderAutonomousClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order autonomous claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSupplyChainResilienceIntegrityGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSupplyChainResilienceIntegrityGating, ...(tenantPolicy.pqSupplyChainResilienceIntegrityGating || {}) };
    if (typeof config.resilienceQuorum === 'number' && config.resilienceQuorum < policy.minResilienceQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `resilience quorum ${config.resilienceQuorum} below minimum ${policy.minResilienceQuorum}`);
    }
    if (typeof config.resilienceWindowSeconds === 'number' && config.resilienceWindowSeconds > policy.maxResilienceWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `resilience window seconds ${config.resilienceWindowSeconds} exceeds maximum ${policy.maxResilienceWindowSeconds}`);
    }
    if (typeof config.resilienceChainDepth === 'number' && config.resilienceChainDepth > policy.maxResilienceChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `resilience chain depth ${config.resilienceChainDepth} exceeds maximum ${policy.maxResilienceChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireSupplyChainResilienceAuthorityInitializerAttestation && config.supplyChainResilienceAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'supply chain resilience authority initializer attestation is required');
    }
    if (policy.requireSupplyChainEthicsOversightCommitteeAttestation && config.supplyChainEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'supply chain ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderResilienceClaims === 'boolean' && policy.banMalformedOrOutOfOrderResilienceClaims && !config.banMalformedOrOutOfOrderResilienceClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order resilience claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSmartContractVerifiableExecutionGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSmartContractVerifiableExecutionGating, ...(tenantPolicy.pqSmartContractVerifiableExecutionGating || {}) };
    if (typeof config.executionQuorum === 'number' && config.executionQuorum < policy.minExecutionQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `execution quorum ${config.executionQuorum} below minimum ${policy.minExecutionQuorum}`);
    }
    if (typeof config.executionWindowSeconds === 'number' && config.executionWindowSeconds > policy.maxExecutionWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `execution window seconds ${config.executionWindowSeconds} exceeds maximum ${policy.maxExecutionWindowSeconds}`);
    }
    if (typeof config.executionChainDepth === 'number' && config.executionChainDepth > policy.maxExecutionChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `execution chain depth ${config.executionChainDepth} exceeds maximum ${policy.maxExecutionChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireExecutionAuthorityInitializerAttestation && config.executionAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'execution authority initializer attestation is required');
    }
    if (policy.requireExecutionEthicsOversightCommitteeAttestation && config.executionEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'execution ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderExecutionClaims === 'boolean' && policy.banMalformedOrOutOfOrderExecutionClaims && !config.banMalformedOrOutOfOrderExecutionClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order execution claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqDecentralizedIdentityProofGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqDecentralizedIdentityProofGating, ...(tenantPolicy.pqDecentralizedIdentityProofGating || {}) };
    if (typeof config.identityQuorum === 'number' && config.identityQuorum < policy.minIdentityQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `identity quorum ${config.identityQuorum} below minimum ${policy.minIdentityQuorum}`);
    }
    if (typeof config.revocationWindowSeconds === 'number' && config.revocationWindowSeconds > policy.maxRevocationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `revocation window seconds ${config.revocationWindowSeconds} exceeds maximum ${policy.maxRevocationWindowSeconds}`);
    }
    if (typeof config.identityChainDepth === 'number' && config.identityChainDepth > policy.maxIdentityChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `identity chain depth ${config.identityChainDepth} exceeds maximum ${policy.maxIdentityChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireIdentityAuthorityInitializerAttestation && config.identityAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'identity authority initializer attestation is required');
    }
    if (policy.requireIdentityEthicsOversightCommitteeAttestation && config.identityEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'identity ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderIdentityClaims === 'boolean' && policy.banMalformedOrOutOfOrderIdentityClaims && !config.banMalformedOrOutOfOrderIdentityClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order identity claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqCrossShardAssetTeleportationGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqCrossShardAssetTeleportationGating, ...(tenantPolicy.pqCrossShardAssetTeleportationGating || {}) };
    if (typeof config.teleportationQuorum === 'number' && config.teleportationQuorum < policy.minTeleportationQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `teleportation quorum ${config.teleportationQuorum} below minimum ${policy.minTeleportationQuorum}`);
    }
    if (typeof config.finalityWindowSeconds === 'number' && config.finalityWindowSeconds > policy.maxFinalityWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `finality window seconds ${config.finalityWindowSeconds} exceeds maximum ${policy.maxFinalityWindowSeconds}`);
    }
    if (typeof config.teleportationChainDepth === 'number' && config.teleportationChainDepth > policy.maxTeleportationChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `teleportation chain depth ${config.teleportationChainDepth} exceeds maximum ${policy.maxTeleportationChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireTeleportationAuthorityInitializerAttestation && config.teleportationAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'teleportation authority initializer attestation is required');
    }
    if (policy.requireTeleportationEthicsOversightCommitteeAttestation && config.teleportationEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'teleportation ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderTeleportClaims === 'boolean' && policy.banMalformedOrOutOfOrderTeleportClaims && !config.banMalformedOrOutOfOrderTeleportClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order teleport claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqDecentralizedEnergyGridBalancingGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqDecentralizedEnergyGridBalancingGating, ...(tenantPolicy.pqDecentralizedEnergyGridBalancingGating || {}) };
    if (typeof config.gridQuorum === 'number' && config.gridQuorum < policy.minGridQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `grid quorum ${config.gridQuorum} below minimum ${policy.minGridQuorum}`);
    }
    if (typeof config.balancingWindowSeconds === 'number' && config.balancingWindowSeconds > policy.maxBalancingWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `balancing window seconds ${config.balancingWindowSeconds} exceeds maximum ${policy.maxBalancingWindowSeconds}`);
    }
    if (typeof config.gridBalancingChainDepth === 'number' && config.gridBalancingChainDepth > policy.maxGridBalancingChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `grid balancing chain depth ${config.gridBalancingChainDepth} exceeds maximum ${policy.maxGridBalancingChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireEnergyGridAuthorityInitializerAttestation && config.energyGridAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'energy grid authority initializer attestation is required');
    }
    if (policy.requireGridEthicsOversightCommitteeAttestation && config.gridEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'grid ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderEnergyGridClaims === 'boolean' && policy.banMalformedOrOutOfOrderEnergyGridClaims && !config.banMalformedOrOutOfOrderEnergyGridClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order energy grid claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqSpaceBasedLaserCommunicationMeshGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqSpaceBasedLaserCommunicationMeshGating, ...(tenantPolicy.pqSpaceBasedLaserCommunicationMeshGating || {}) };
    if (typeof config.laserMeshQuorum === 'number' && config.laserMeshQuorum < policy.minLaserMeshQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `laser mesh quorum ${config.laserMeshQuorum} below minimum ${policy.minLaserMeshQuorum}`);
    }
    if (typeof config.handoffWindowSeconds === 'number' && config.handoffWindowSeconds > policy.maxHandoffWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `handoff window seconds ${config.handoffWindowSeconds} exceeds maximum ${policy.maxHandoffWindowSeconds}`);
    }
    if (typeof config.laserMeshChainDepth === 'number' && config.laserMeshChainDepth > policy.maxLaserMeshChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `laser mesh chain depth ${config.laserMeshChainDepth} exceeds maximum ${policy.maxLaserMeshChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireLaserMeshAuthorityInitializerAttestation && config.laserMeshAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'laser mesh authority initializer attestation is required');
    }
    if (policy.requireLaserEthicsOversightCommitteeAttestation && config.laserEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'laser ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderLaserMeshClaims === 'boolean' && policy.banMalformedOrOutOfOrderLaserMeshClaims && !config.banMalformedOrOutOfOrderLaserMeshClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order laser mesh claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqQuantumKeyDistributionLinkSwitchGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqQuantumKeyDistributionLinkSwitchGating, ...(tenantPolicy.pqQuantumKeyDistributionLinkSwitchGating || {}) };
    if (typeof config.qkdQuorum === 'number' && config.qkdQuorum < policy.minQkdQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `qkd quorum ${config.qkdQuorum} below minimum ${policy.minQkdQuorum}`);
    }
    if (typeof config.entanglementWindowSeconds === 'number' && config.entanglementWindowSeconds > policy.maxEntanglementWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `entanglement window seconds ${config.entanglementWindowSeconds} exceeds maximum ${policy.maxEntanglementWindowSeconds}`);
    }
    if (typeof config.qkdSwitchChainDepth === 'number' && config.qkdSwitchChainDepth > policy.maxQkdSwitchChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `qkd switch chain depth ${config.qkdSwitchChainDepth} exceeds maximum ${policy.maxQkdSwitchChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireQkdLinkAuthorityInitializerAttestation && config.qkdLinkAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'qkd link authority initializer attestation is required');
    }
    if (policy.requireQkdEthicsOversightCommitteeAttestation && config.qkdEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'qkd ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderQkdLinkClaims === 'boolean' && policy.banMalformedOrOutOfOrderQkdLinkClaims && !config.banMalformedOrOutOfOrderQkdLinkClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order qkd link claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validatePqHolographicStorageContentAddressableGating(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.pqHolographicStorageContentAddressableGating, ...(tenantPolicy.pqHolographicStorageContentAddressableGating || {}) };
    if (typeof config.holographicQuorum === 'number' && config.holographicQuorum < policy.minHolographicQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `holographic quorum ${config.holographicQuorum} below minimum ${policy.minHolographicQuorum}`);
    }
    if (typeof config.phaseValidationWindowSeconds === 'number' && config.phaseValidationWindowSeconds > policy.maxPhaseValidationWindowSeconds) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `phase validation window seconds ${config.phaseValidationWindowSeconds} exceeds maximum ${policy.maxPhaseValidationWindowSeconds}`);
    }
    if (typeof config.volumetricChainDepth === 'number' && config.volumetricChainDepth > policy.maxVolumetricChainDepth) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `volumetric chain depth ${config.volumetricChainDepth} exceeds maximum ${policy.maxVolumetricChainDepth}`);
    }
    if (typeof config.pqcSignatureScheme === 'string' && !policy.allowedPqcSignatureSchemes.includes(config.pqcSignatureScheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `PQC signature scheme ${config.pqcSignatureScheme} is not permitted; allowed: ${policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (policy.requireHolographicStorageAuthorityInitializerAttestation && config.holographicStorageAuthorityInitializerAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'holographic storage authority initializer attestation is required');
    }
    if (policy.requireHolographicEthicsOversightCommitteeAttestation && config.holographicEthicsOversightCommitteeAttestation === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'holographic ethics oversight committee attestation is required');
    }
    if (typeof config.attestationAuthority === 'string' && !policy.allowedAttestationAuthorities.includes(config.attestationAuthority)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `attestation authority ${config.attestationAuthority} is not allowed; permitted: ${policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof config.banMalformedOrOutOfOrderHolographicClaims === 'boolean' && policy.banMalformedOrOutOfOrderHolographicClaims && !config.banMalformedOrOutOfOrderHolographicClaims) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ban malformed or out-of-order holographic claims must remain enabled');
    }
    if (policy.requireCanonicalPayloadLayout && config.canonicalPayloadLayout === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'canonical payload layout is required');
    }
  }

  _validateFips(tenantPolicy, config) {
    const policy = tenantPolicy.fips || DEFAULT_POLICY.fips;
    if (!policy.enabled) return;

    if (config.algorithm === 'ecdh') {
      const curve = typeof config.keySize === 'number' ? `P-${config.keySize}` : config.keySize;
      if (typeof curve === 'string' && !policy.allowedCurves.includes(curve)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: ECDH curve ${curve} is not approved; permitted: ${policy.allowedCurves.join(', ')}`);
      }
    }

    if (config.algorithm === 'pqc' || config.algorithm === 'hybrid-kem') {
      const kemLevel = config.kemLevel;
      if (typeof kemLevel === 'number' && !policy.allowedKemLevels.includes(kemLevel)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: KEM level ${kemLevel} is not approved; permitted: ${policy.allowedKemLevels.join(', ')}`);
      }
    }

    if (config.algorithm === 'homomorphic' || config.algorithm === 'blinding') {
      if (config.allowBlinding && !policy.allowBlinding) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'FIPS mode: homomorphic blinding is not approved');
      }
      if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.graceTokenExpiryMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: token expiry grace window ${config.tokenExpiryMs}ms exceeds approved ${policy.graceTokenExpiryMs}ms`);
      }
    }

    if (config.algorithm === 'zkp') {
      if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.graceTokenExpiryMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: ZKP token grace window ${config.tokenExpiryMs}ms exceeds approved ${policy.graceTokenExpiryMs}ms`);
      }
    }
  }

  _validateEscrow(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.escrow, ...(tenantPolicy.escrow || {}) };
    if (config.sourceTenantId === config.destTenantId) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'source and destination tenant must be different');
    }
    if (typeof config.consentCount === 'number' && config.consentCount < policy.minAuthorizationQuorum) {
      throw new HsmAdapterError('ESCROW_CONSENT_MISSING', `only ${config.consentCount} consent signatures, require ${policy.minAuthorizationQuorum}`);
    }
    if (policy.requireDualConsent && typeof config.consentCount === 'number' && config.consentCount < 2) {
      throw new HsmAdapterError('ESCROW_CONSENT_MISSING', 'dual consent is required');
    }
    if (typeof config.escrowLifetimeMs === 'number' && config.escrowLifetimeMs > policy.maxEscrowLifetimeMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `escrow lifetime ${config.escrowLifetimeMs}ms exceeds policy ${policy.maxEscrowLifetimeMs}ms`);
    }
    if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.declassificationTokenExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `token expiry ${config.tokenExpiryMs}ms exceeds policy ${policy.declassificationTokenExpiryMs}ms`);
    }
    if (typeof config.algorithm === 'string' && policy.allowedEscrowAlgorithms.length > 0 && !policy.allowedEscrowAlgorithms.includes(config.algorithm)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `escrow algorithm ${config.algorithm} is not allowed`);
    }
  }

  _validateBlind(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.privacy.blindSignature, ...((tenantPolicy.privacy && tenantPolicy.privacy.blindSignature) || {}) };
    if (typeof config.publicExponent === 'number' && policy.allowedPublicExponents.length > 0 && !policy.allowedPublicExponents.includes(config.publicExponent)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `public exponent ${config.publicExponent} is not allowed for blind signatures`);
    }
    if (typeof config.modulusBits === 'number' && config.modulusBits < policy.minModulusBits) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `modulus bits ${config.modulusBits} below policy minimum ${policy.minModulusBits}`);
    }
    if (typeof config.hashFunction === 'string' && policy.allowedHashFunctions.length > 0 && !policy.allowedHashFunctions.includes(config.hashFunction)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `hash function ${config.hashFunction} is not allowed for blind signatures`);
    }
  }

  _validatePir(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.privacy.pir, ...((tenantPolicy.privacy && tenantPolicy.privacy.pir) || {}) };
    if (typeof config.rows === 'number' && config.rows > policy.maxRows) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir rows ${config.rows} exceed policy ${policy.maxRows}`);
    }
    if (typeof config.columns === 'number' && config.columns > policy.maxDimensions) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir dimensions ${config.columns} exceed policy ${policy.maxDimensions}`);
    }
    if (typeof config.querySizeBytes === 'number' && config.querySizeBytes > policy.maxQuerySizeBytes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir query size ${config.querySizeBytes} bytes exceeds policy ${policy.maxQuerySizeBytes} bytes`);
    }
    if (typeof config.scheme === 'string' && policy.allowedHomomorphicSchemes.length > 0 && !policy.allowedHomomorphicSchemes.includes(config.scheme)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `pir homomorphic scheme ${config.scheme} is not allowed`);
    }
  }

  _validateAlgorithm(tenantPolicy, algorithm, keySize) {
    const allowed = tenantPolicy.allowedAlgorithms;
    if (!algorithm) return;

    if (algorithm === 'aes-kw' || algorithm === 'aes-kwp') {
      if (!allowed || !allowed.aes) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `AES is not allowed by tenant policy`);
      }
      const mode = algorithm === 'aes-kwp' ? 'kwp' : 'kw';
      if (!allowed.aes[mode]) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `${algorithm} is not allowed by tenant policy`);
      }
      if (typeof keySize === 'number' && allowed.aes.bits && !allowed.aes.bits.includes(keySize)) {
        throw new HsmAdapterError(
          'POLICY_VIOLATION_BLOCKED',
          `AES ${keySize}-bit not allowed; permitted: ${allowed.aes.bits.join(', ')}`
        );
      }
      return;
    }

    if (algorithm === 'rsa-oaep') {
      if (!allowed || !allowed.rsa || !allowed.rsa.oaep) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'RSA-OAEP is not allowed by tenant policy');
      }
      if (typeof keySize === 'number' && allowed.rsa.minBits && keySize < allowed.rsa.minBits) {
        throw new HsmAdapterError(
          'POLICY_VIOLATION_BLOCKED',
          `RSA-OAEP keySize ${keySize} is below tenant minimum ${allowed.rsa.minBits}`
        );
      }
      return;
    }

    if (algorithm === 'ecdh') {
      if (!allowed || !allowed.ecdh) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'ECDH is not allowed by tenant policy');
      }
      const curve = typeof keySize === 'number' ? `P-${keySize}` : keySize;
      if (typeof curve === 'string' && allowed.ecdh.curves && !allowed.ecdh.curves.includes(curve)) {
        throw new HsmAdapterError(
          'POLICY_VIOLATION_BLOCKED',
          `ECDH curve ${curve} is not allowed; permitted: ${allowed.ecdh.curves.join(', ')}`
        );
      }
      return;
    }

    throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `Algorithm ${algorithm} is not recognized by policy`);
  }

  _validatePqc(tenantPolicy, config) {
    const policy = tenantPolicy.pqc || DEFAULT_POLICY.pqc;
    const kemLevel = config.kemLevel;
    if (typeof kemLevel === 'number') {
      if (kemLevel < policy.minKemLevel || kemLevel > policy.maxKemLevel) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `kemLevel ${kemLevel} is outside allowed [${policy.minKemLevel}, ${policy.maxKemLevel}]`);
      }
      const validLevels = [512, 768, 1024];
      if (!validLevels.includes(kemLevel)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `kemLevel ${kemLevel} is not a supported PQC level`);
      }
    }
    if (config.hybridMode === true && !policy.hybridMode) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'hybrid PQC mode is not allowed by policy');
    }
  }

  _validateZkp(tenantPolicy, config) {
    const policy = tenantPolicy.zkp || DEFAULT_POLICY.zkp;
    if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.tokenExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `tokenExpiryMs ${config.tokenExpiryMs} exceeds policy ${policy.tokenExpiryMs}`);
    }
    if (typeof config.maxProofs === 'number' && config.maxProofs > policy.maxProofs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxProofs ${config.maxProofs} exceeds policy ${policy.maxProofs}`);
    }
    if (typeof config.primeHex === 'string' && policy.allowedPrimes.length > 0 && !policy.allowedPrimes.includes(config.primeHex)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'prime is not in allowedPrimes list');
    }
  }

  _validateTime(tenantPolicy, config) {
    const policy = tenantPolicy.time || DEFAULT_POLICY.time;
    if (typeof config.maxDriftMs === 'number' && config.maxDriftMs > policy.maxDriftMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxDriftMs ${config.maxDriftMs} exceeds policy ${policy.maxDriftMs}`);
    }
    if (typeof config.minQuorum === 'number' && config.minQuorum < policy.minQuorum) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `minQuorum ${config.minQuorum} below policy ${policy.minQuorum}`);
    }
  }

  _validateHomomorphic(tenantPolicy, config) {
    const policy = tenantPolicy.homomorphic || DEFAULT_POLICY.homomorphic;
    if (typeof config.maxModulusBits === 'number' && config.maxModulusBits > policy.maxModulusBits) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxModulusBits ${config.maxModulusBits} exceeds policy ${policy.maxModulusBits}`);
    }
    if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.tokenExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `tokenExpiryMs ${config.tokenExpiryMs} exceeds policy ${policy.tokenExpiryMs}`);
    }
    if (typeof config.allowBlinding === 'boolean' && config.allowBlinding && !policy.allowBlinding) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'blinding is not allowed by policy');
    }
  }

  _validateRatchet(tenantPolicy, config) {
    const policy = tenantPolicy.ratchet || DEFAULT_POLICY.ratchet;
    if (typeof config.maxSkipped === 'number' && config.maxSkipped > policy.maxSkipped) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `maxSkipped ${config.maxSkipped} exceeds policy ${policy.maxSkipped}`);
    }
    if (typeof config.sessionExpiryMs === 'number' && config.sessionExpiryMs > policy.sessionExpiryMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `sessionExpiryMs ${config.sessionExpiryMs} exceeds policy ${policy.sessionExpiryMs}`);
    }
    if (typeof config.allowDhRatchet === 'boolean' && config.allowDhRatchet && !policy.allowDhRatchet) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'DH ratchet is not allowed by policy');
    }
  }

  _validateFips(tenantPolicy, config) {
    const policy = { ...DEFAULT_POLICY.fips, ...(tenantPolicy.fips || {}) };
    if (!policy.enabled) return;

    if (config.algorithm === 'ecdh') {
      const curve = typeof config.keySize === 'number' ? `P-${config.keySize}` : config.keySize;
      if (typeof curve === 'string' && !policy.allowedCurves.includes(curve)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: ECDH curve ${curve} is not approved; permitted: ${policy.allowedCurves.join(', ')}`);
      }
    }

    if (config.algorithm === 'pqc' || config.algorithm === 'hybrid-kem') {
      const kemLevel = config.kemLevel;
      if (typeof kemLevel === 'number' && !policy.allowedKemLevels.includes(kemLevel)) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: KEM level ${kemLevel} is not approved; permitted: ${policy.allowedKemLevels.join(', ')}`);
      }
    }

    if (config.algorithm === 'homomorphic' || config.algorithm === 'blinding') {
      if (config.allowBlinding && !policy.allowBlinding) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'FIPS mode: homomorphic blinding is not approved');
      }
      if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.graceTokenExpiryMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: token expiry grace window ${config.tokenExpiryMs}ms exceeds approved ${policy.graceTokenExpiryMs}ms`);
      }
    }

    if (config.algorithm === 'zkp') {
      if (typeof config.tokenExpiryMs === 'number' && config.tokenExpiryMs > policy.graceTokenExpiryMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `FIPS mode: ZKP token grace window ${config.tokenExpiryMs}ms exceeds approved ${policy.graceTokenExpiryMs}ms`);
      }
    }
  }

  _validateThreshold(tenantPolicy, threshold, total) {
    const policy = tenantPolicy.threshold || DEFAULT_POLICY.threshold;
    if (typeof threshold !== 'number' || typeof total !== 'number') {
      throw new HsmAdapterError('INVALID_THRESHOLD', 'threshold and total must be numbers');
    }
    if (threshold < 1 || total < 1 || threshold > total) {
      throw new HsmAdapterError('INVALID_THRESHOLD', `threshold (${threshold}) must satisfy 1 Γëñ threshold Γëñ total (${total})`);
    }
    if (threshold < policy.minThreshold) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `threshold ${threshold} is below policy minimum ${policy.minThreshold}`);
    }
    if (total > policy.maxTotal) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', `total ${total} exceeds policy maximum ${policy.maxTotal}`);
    }
  }

  _checkDeprecation(tenantPolicy, algorithm, createdAt) {
    const deprecated = (tenantPolicy.deprecatedAlgorithms || []).find(
      (d) => d.algorithm === algorithm
    );
    if (deprecated) {
      throw new HsmAdapterError(
        'POLICY_DEPRECATED_WARNING',
        `Algorithm ${algorithm} is deprecated: ${deprecated.reason || 'no reason provided'}`
      );
    }

    const expiryDays = tenantPolicy.keyExpirationDays;
    if (createdAt && expiryDays > 0) {
      const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (ageDays > expiryDays) {
        throw new HsmAdapterError(
          'POLICY_DEPRECATED_WARNING',
          `Key has exceeded policy lifetime (${ageDays.toFixed(1)} days > ${expiryDays} days)`
        );
      }
    }
  }

  /**
   * Validate an operation for a tenant against the active policy.
   * @param {string} tenantId
   * @param {string} operation - 'createKEK', 'wrap', 'unwrap', 'rotateKEK', 'threshold'
   * @param {object} config - { algorithm, keySize, kekBits, createdAt, threshold, total }
   * @returns {boolean}
   */
  validate(tenantId, operation, config = {}) {
    if (!this._strict) return true;
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new HsmAdapterError('UNAUTHORIZED_KEY_ACCESS', 'tenantId must be a non-empty string');
    }

    const tenantPolicy = this._getTenantPolicy(tenantId);

    this._validateFips(tenantPolicy, config);

    if (operation === 'threshold') {
      this._validateThreshold(tenantPolicy, config.threshold, config.total);
      return true;
    }

    if (operation === 'ratchet') {
      this._validateRatchet(tenantPolicy, config);
      return true;
    }

    if (operation === 'escrow') {
      this._validateEscrow(tenantPolicy, config);
      return true;
    }

    if (operation === 'blind') {
      this._validateBlind(tenantPolicy, config);
      return true;
    }

    if (operation === 'pir') {
      this._validatePir(tenantPolicy, config);
      return true;
    }

    if (operation === 'homomorphic') {
      this._validateHomomorphic(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqc') {
      this._validatePqc(tenantPolicy, config);
      return true;
    }

    if (operation === 'zkp') {
      this._validateZkp(tenantPolicy, config);
      return true;
    }

    if (operation === 'governance') {
      this._validateGovernance(tenantPolicy, config);
      return true;
    }

    if (operation === 'identity') {
      this._validateIdentity(tenantPolicy, config);
      return true;
    }

    if (operation === 'recoverySync') {
      this._validateRecoverySync(tenantPolicy, config);
      return true;
    }

    if (operation === 'consensus') {
      this._validateConsensus(tenantPolicy, config);
      return true;
    }

    if (operation === 'enclave') {
      this._validateEnclave(tenantPolicy, config);
      return true;
    }

    if (operation === 'secretSealing') {
      this._validateSecretSealing(tenantPolicy, config);
      return true;
    }

    if (operation === 'resharding') {
      this._validateResharding(tenantPolicy, config);
      return true;
    }

    if (operation === 'disasterRecovery') {
      this._validateDisasterRecovery(tenantPolicy, config);
      return true;
    }

    if (operation === 'confidentialIssuance') {
      this._validateConfidentialIssuance(tenantPolicy, config);
      return true;
    }

    if (operation === 'crossTenantAudit') {
      this._validateCrossTenantAudit(tenantPolicy, config);
      return true;
    }

    if (operation === 'homomorphicComputation') {
      this._validateHomomorphicComputation(tenantPolicy, config);
      return true;
    }

    if (operation === 'hardwareRootRotation') {
      this._validateHardwareRootRotation(tenantPolicy, config);
      return true;
    }

    if (operation === 'assetBridge') {
      this._validateAssetBridge(tenantPolicy, config);
      return true;
    }

    if (operation === 'homomorphicDbLookup') {
      this._validateHomomorphicDbLookup(tenantPolicy, config);
      return true;
    }

    if (operation === 'zkSettlement') {
      this._validateZkSettlement(tenantPolicy, config);
      return true;
    }

    if (operation === 'dkg') {
      this._validateDkg(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqcIdentityHub') {
      this._validatePqcIdentityHub(tenantPolicy, config);
      return true;
    }

    if (operation === 'zkTokenAttestation') {
      this._validateZkTokenAttestation(tenantPolicy, config);
      return true;
    }

    if (operation === 'homomorphicKeySharding') {
      this._validateHomomorphicKeySharding(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqcThreshold') {
      this._validatePqcThreshold(tenantPolicy, config);
      return true;
    }

    if (operation === 'mpcGatedDecryption') {
      this._validateMpcGatedDecryption(tenantPolicy, config);
      return true;
    }

    if (operation === 'encryptedDeduplication') {
      this._validateEncryptedDeduplication(tenantPolicy, config);
      return true;
    }

    if (operation === 'confidentialSandbox') {
      this._validateConfidentialSandbox(tenantPolicy, config);
      return true;
    }

    if (operation === 'encryptedSearchRouting') {
      this._validateEncryptedSearchRouting(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqIdentityAccumulator') {
      this._validatePqIdentityAccumulator(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqcVestingLocks') {
      this._validatePqcVestingLocks(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqcCrossChainGovernance') {
      this._validatePqcCrossChainGovernance(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqcHomomorphicIdentityBridge') {
      this._validatePqcHomomorphicIdentityBridge(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqIdentityRevocation') {
      this._validatePqIdentityRevocation(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqTimeLockedMatrix') {
      this._validatePqTimeLockedMatrix(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqBlindOptionPools') {
      this._validatePqBlindOptionPools(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqPredictionMarkets') {
      this._validatePqPredictionMarkets(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqFractionalCustody') {
      this._validatePqFractionalCustody(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqLendingPools') {
      this._validatePqLendingPools(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqInsuranceUnderwriting') {
      this._validatePqInsuranceUnderwriting(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSupplyChainEscrow') {
      this._validatePqSupplyChainEscrow(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqRealEstateTokenization') {
      this._validatePqRealEstateTokenization(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqCarbonTokenization') {
      this._validatePqCarbonTokenization(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqIdentityGating') {
      this._validatePqIdentityGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqHealthDataGating') {
      this._validatePqHealthDataGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqEducationGating') {
      this._validatePqEducationGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqPatentGating') {
      this._validatePqPatentGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqEnergyGating') {
      this._validatePqEnergyGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSupplyChainGating') {
      this._validatePqSupplyChainGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqBiometricGating') {
      this._validatePqBiometricGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqDerivativeGating') {
      this._validatePqDerivativeGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqClinicalTrialGating') {
      this._validatePqClinicalTrialGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSortitionGating') {
      this._validatePqSortitionGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqLogisticsGating') {
      this._validatePqLogisticsGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqTrainingGating') {
      this._validatePqTrainingGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqResearchGating') {
      this._validatePqResearchGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqTreasuryGating') {
      this._validatePqTreasuryGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqTelecomGating') {
      this._validatePqTelecomGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqInsuranceGating') {
      this._validatePqInsuranceGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSpaceGating') {
      this._validatePqSpaceGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqWaterGating') {
      this._validatePqWaterGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqNuclearGating') {
      this._validatePqNuclearGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqWildlifeGating') {
      this._validatePqWildlifeGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSmartGridGating') {
      this._validatePqSmartGridGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqEpidemiologyGating') {
      this._validatePqEpidemiologyGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqHeritageGating') {
      this._validatePqHeritageGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqFisheriesGating') {
      this._validatePqFisheriesGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSeabedGating') {
      this._validatePqSeabedGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqPolarResearchGating') {
      this._validatePqPolarResearchGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqStratosphericAerosolGating') {
      this._validatePqStratosphericAerosolGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqOrbitalDebrisTrackingGating') {
      this._validatePqOrbitalDebrisTrackingGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqGenomicPrivacyComplianceGating') {
      this._validatePqGenomicPrivacyComplianceGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqQuantumSensorCalibrationGating') {
      this._validatePqQuantumSensorCalibrationGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqNeuralNetworkInferenceIntegrityGating') {
      this._validatePqNeuralNetworkInferenceIntegrityGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqAutonomousVehicleFleetCoordinationGating') {
      this._validatePqAutonomousVehicleFleetCoordinationGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSupplyChainResilienceIntegrityGating') {
      this._validatePqSupplyChainResilienceIntegrityGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSmartContractVerifiableExecutionGating') {
      this._validatePqSmartContractVerifiableExecutionGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqDecentralizedIdentityProofGating') {
      this._validatePqDecentralizedIdentityProofGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqCrossShardAssetTeleportationGating') {
      this._validatePqCrossShardAssetTeleportationGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqDecentralizedEnergyGridBalancingGating') {
      this._validatePqDecentralizedEnergyGridBalancingGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqSpaceBasedLaserCommunicationMeshGating') {
      this._validatePqSpaceBasedLaserCommunicationMeshGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqQuantumKeyDistributionLinkSwitchGating') {
      this._validatePqQuantumKeyDistributionLinkSwitchGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'pqHolographicStorageContentAddressableGating') {
      this._validatePqHolographicStorageContentAddressableGating(tenantPolicy, config);
      return true;
    }

    if (operation === 'time') {
      this._validateTime(tenantPolicy, config);
      return true;
    }

    if (typeof config.kekBits === 'number') {
      this._validateBits(tenantPolicy, config.kekBits, 'kekBits');
    }

    this._validateAlgorithm(tenantPolicy, config.algorithm, config.keySize || config.kekBits);
    this._checkDeprecation(tenantPolicy, config.algorithm, config.createdAt);

    return true;
  }
}

module.exports = {
  CryptoPolicyEngine,
  DEFAULT_POLICY,
};
