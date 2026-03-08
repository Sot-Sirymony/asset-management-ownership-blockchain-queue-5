#!/usr/bin/env bash
# Redeploy chaincode with a new version (e.g. after adding UpdatedAt).
# Bump version/sequence each redeploy so install succeeds (Fabric rejects same package twice).
# Run from network root: ./net.sh redeploy-cc
set -euo pipefail

peer0=peer0.org1.ownify.com
chaincode_path=../src/go
export FABRIC_CFG_PATH=${PWD}/../config
chaincode_name=basic
version=3
sequence=3
channel_name=channel-org
org_msp="Org1MSP"
peer_address=peer0.org1.ownify.com:7051
orderer_address=orderer.ownify.com:7050
tls_cert_path=${PWD}/../crypto-config/peerOrganizations/org1.ownify.com/peers/peer0.org1.ownify.com/tls/ca.crt
msp_path=${PWD}/../crypto-config/peerOrganizations/org1.ownify.com/users/Admin@org1.ownify.com/msp
orderer_tls_cert=${PWD}/../crypto-config/ordererOrganizations/ownify.com/orderers/orderer.ownify.com/msp/tlscacerts/tlsca.ownify.com-cert.pem

vendorGoDependencies() {
    echo Vendoring Go dependencies...
    pushd $chaincode_path
    GO111MODULE=on go mod vendor
    popd
    echo Finished vendoring Go dependencies
}

packageChaincode() {
    echo "Packaging chaincode (version ${version})..."
    peer lifecycle chaincode package ${chaincode_name}.tar.gz \
        --path ${chaincode_path} \
        --lang golang \
        --label ${chaincode_name}_${version}
    echo "Chaincode is packaged."
}

setPeerEnv() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org1MSP"
    export CORE_PEER_TLS_ROOTCERT_FILE=${tls_cert_path}
    export CORE_PEER_MSPCONFIGPATH=${msp_path}
    export CORE_PEER_ADDRESS=${peer_address}
}

installChaincode() {
    echo "Installing chaincode..."
    peer lifecycle chaincode install ${chaincode_name}.tar.gz
    echo "Chaincode installed on peer0.org1."
}

queryInstalled() {
    echo "Querying installed chaincode..."
    peer lifecycle chaincode queryinstalled >&log.txt
    PACKAGE_ID=$(sed -n "/${chaincode_name}_${version}/{s/^Package ID: //; s/, Label:.*$//; p;}" log.txt)
    echo "Package ID is ${PACKAGE_ID}"
}

approveForMyOrg1() {
    echo "Approving chaincode definition for org1 (version ${version}, sequence ${sequence})..."
    peer lifecycle chaincode approveformyorg -o ${orderer_address} \
        --tls --cafile ${orderer_tls_cert} \
        --channelID ${channel_name} --name ${chaincode_name} \
        --version ${version} --sequence ${sequence} \
        --package-id ${PACKAGE_ID} --init-required
    echo "Chaincode approved by org1."
}

checkCommitReadyness() {
    echo "Checking commit readiness..."
    peer lifecycle chaincode checkcommitreadiness \
        --channelID ${channel_name} --name ${chaincode_name} \
        --version ${version} --sequence ${sequence} --output json --init-required
    echo "Commit readiness checked."
}

commitChaincodeDefinition() {
    echo "Committing chaincode definition..."
    peer lifecycle chaincode commit -o ${orderer_address} \
        --tls --cafile ${orderer_tls_cert} \
        --channelID ${channel_name} --name ${chaincode_name} \
        --peerAddresses ${peer_address} --tlsRootCertFiles ${tls_cert_path} \
        --version ${version} --sequence ${sequence} --init-required
    echo "Chaincode definition committed."
}

queryCommitted() {
    echo "Querying committed chaincode..."
    peer lifecycle chaincode querycommitted --channelID ${channel_name} --name ${chaincode_name}
    echo "Chaincode committed."
}

chaincodeInvokeInit() {
    echo "Invoking chaincode init..."
    peer chaincode invoke -o ${orderer_address} \
        --tls --cafile ${orderer_tls_cert} \
        --channelID ${channel_name} --name ${chaincode_name} \
        --peerAddresses ${peer_address} --tlsRootCertFiles ${tls_cert_path} \
        --isInit -c '{"Args":[]}'
    echo "Chaincode initialization invoked."
}

vendorGoDependencies
packageChaincode
setPeerEnv
installChaincode
queryInstalled
sleep 5
approveForMyOrg1
checkCommitReadyness
commitChaincodeDefinition
queryCommitted
sleep 5
chaincodeInvokeInit
echo "Redeploy complete. Chaincode version ${version} is active."
