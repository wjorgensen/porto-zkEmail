pragma solidity >=0.8.13;
import "@zk-email/contracts/interfaces/IDKIMRegistry.sol";
import "@zk-email/contracts/utils/StringUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./verifier.sol";
contract Contract is Ownable {
    // ============================
    // Dependent Contracts
    // ============================
    IDKIMRegistry public dkimRegistry;
    Verifier public verifier;
    // ============================
    // Prover Constants (Auto-generated)
    // ============================
    uint16 public constant pack_size = 31;
    string public constant domain = "poof.ing";
    uint16 public constant subject_len = 2;
    uint16 public constant sender_domain_len = 1;
    uint16 public constant email_timestamp_len = 1;
    uint16 public constant email_recipient_len = 3;
    constructor (IDKIMRegistry r, Verifier v) Ownable(msg.sender) {
        dkimRegistry = r;
        verifier = v;
    }
    function verify(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[11] calldata signals) external view {
        // verify RSA
        bytes32 ph = bytes32(signals[0]);
        require(dkimRegistry.isDKIMPublicKeyHashValid(domain, ph), "RSA public key incorrect");
        // verify proof
        require(verifier.verifyProof(a,b,c,signals), "Invalid proof");
    }
}
