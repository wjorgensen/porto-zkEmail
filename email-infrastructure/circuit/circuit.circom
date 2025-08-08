pragma circom 2.1.6;
include "@zk-email/circuits/email-verifier.circom";
include "@zk-email/circuits/utils/regex.circom";
include "./regex/subjectRegex.circom";
include "./regex/sender_domainRegex.circom";
include "./regex/email_timestampRegex.circom";
include "./regex/email_recipientRegex.circom";
template MailAddressProver(maxHeaderLength, maxBodyLength, n, k, packSize) {
    assert(n * k > 1024); // constraints for 1024 bit RSA
    signal input emailHeader[maxHeaderLength]; // prehashed email data, includes up to 512 + 64 bytes of padding pre SHA256, and padded with lots of 0s at end after the length
    signal input emailHeaderLength;
    signal input pubkey[k]; // RSA pubkey, verified with smart contract + DNSSEC proof. Split up into k parts of n bits each.
    signal input signature[k]; // RSA signature. Split up into k parts of n bits each.
    signal input proverETHAddress;
    
    // DKIM Verification
    component EV = EmailVerifier(maxHeaderLength, maxBodyLength, n, k, 1, 0, 0, 0);
    EV.emailHeader <== emailHeader;
    EV.emailHeaderLength <== emailHeaderLength;
    EV.pubkey <== pubkey;
    EV.signature <== signature;
    
    
    signal output pubkeyHash;
    pubkeyHash <== EV.pubkeyHash;
    
    
    // Used for nullifier later
    signal output headerHashHi <== EV.shaHi;
    signal output headerHashLo <== EV.shaLo;
    
    // SUBJECT Extraction
    
    var subjectMaxLength = 42;
    signal input subjectRegexIdx;
    
    signal subjectRegexOut, subjectRegexReveal[1088];
    (subjectRegexOut, subjectRegexReveal) <== subjectRegex(maxHeaderLength)(emailHeader);
    subjectRegexOut === 1;
    
    
    
    
    signal output subjectPackedOut[computeIntChunkLength(subjectMaxLength)];
    subjectPackedOut <== PackRegexReveal(maxHeaderLength, subjectMaxLength)(subjectRegexReveal, subjectRegexIdx);
    
    
    
    
    
    
    // SENDER_DOMAIN Extraction
    
    var sender_domainMaxLength = 8;
    signal input sender_domainRegexIdx;
    
    signal sender_domainRegexOut, sender_domainRegexReveal[1088];
    (sender_domainRegexOut, sender_domainRegexReveal) <== sender_domainRegex(maxHeaderLength)(emailHeader);
    sender_domainRegexOut === 1;
    
    
    
    
    signal output sender_domainPackedOut[computeIntChunkLength(sender_domainMaxLength)];
    sender_domainPackedOut <== PackRegexReveal(maxHeaderLength, sender_domainMaxLength)(sender_domainRegexReveal, sender_domainRegexIdx);
    
    
    
    
    
    
    // EMAIL_TIMESTAMP Extraction
    
    var email_timestampMaxLength = 10;
    signal input email_timestampRegexIdx;
    
    signal email_timestampRegexOut, email_timestampRegexReveal[1088];
    (email_timestampRegexOut, email_timestampRegexReveal) <== email_timestampRegex(maxHeaderLength)(emailHeader);
    email_timestampRegexOut === 1;
    
    
    
    
    signal output email_timestampPackedOut[computeIntChunkLength(email_timestampMaxLength)];
    email_timestampPackedOut <== PackRegexReveal(maxHeaderLength, email_timestampMaxLength)(email_timestampRegexReveal, email_timestampRegexIdx);
    
    
    
    
    
    
    // EMAIL_RECIPIENT Extraction
    
    var email_recipientMaxLength = 64;
    signal input email_recipientRegexIdx;
    
    signal email_recipientRegexOut, email_recipientRegexReveal[1088];
    (email_recipientRegexOut, email_recipientRegexReveal) <== email_recipientRegex(maxHeaderLength)(emailHeader);
    email_recipientRegexOut === 1;
    
    
    
    
    signal output email_recipientPackedOut[computeIntChunkLength(email_recipientMaxLength)];
    email_recipientPackedOut <== PackRegexReveal(maxHeaderLength, email_recipientMaxLength)(email_recipientRegexReveal, email_recipientRegexIdx);
    
    
    
    
    
    
}
component main { public [proverETHAddress] } = MailAddressProver(1088, 0, 121, 17, 7);
