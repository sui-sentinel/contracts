# AWS Nautilus values start
export PCR0=a86bd6ee6e2ff846e791d9f76677fc53a72255de88ce643ad596f2f212d280aad7657c5a1535b0b2fe1ebcb6e2f106d7
export PCR1=a86bd6ee6e2ff846e791d9f76677fc53a72255de88ce643ad596f2f212d280aad7657c5a1535b0b2fe1ebcb6e2f106d7
export PCR2=21b9efbc184807662e966d34f390821309eeac6802309798826296bf3e8bec7c10edb30948c90ba67310f7b964fc500a
export ENCLAVE_URL=http://18.213.79.225:3000

# AWS Nautilus values end

export MODULE_NAME=sentinel
export OTW_NAME=SENTINEL

echo "PCRS"
echo 0x$PCR0
echo 0x$PCR1
echo 0x$PCR2

echo "module name": $MODULE_NAME
echo "otw name": $OTW_NAME
echo "ENCLAVE_URL: " $ENCLAVE_URL

export ENCLAVE_PACKAGE_ID=EXAMPLE_ENCLAVE_PACKAGE_ID_REPLACE_ME # replace with your enclave package id after building and publishing the enclave package
echo "ENCLAVE_PACKAGE_ID:" $ENCLAVE_PACKAGE_ID

export CAP_OBJECT_ID= EXAMLE_CAP_OBJECT_ID_REPLACE_ME # replace with your created cap object id after running create_cap.sh
export ENCLAVE_CONFIG_OBJECT_ID= # EXAMPLE_ENCLAVE_CONFIG_OBJECT_ID_REPLACE_ME # replace with your created enclave config object id after running create_enclave_config.sh
export APP_PACKAGE_ID= # EXAMPLE_APP_PACKAGE_ID_REPLACE_ME # replace with your application package id after building and publishing your application package
export AGENT_REGISTRY= # EXAMPLE_AGENT_REGISTRY_OBJECT_ID_REPLACE_ME # replace with your created agent registry object id after running create_agent_registry.sh
export PROTOCOL_CONFIG_ID= # EXAMPLE_PROTOCOL_CONFIG_OBJECT_ID_REPLACE_ME # replace with your created protocol config object id after running create_protocol_config.sh

echo "CAP_OBJECT_ID:" $CAP_OBJECT_ID
echo "ENCLAVE_CONFIG_OBJECT_ID:" $ENCLAVE_CONFIG_OBJECT_ID
echo "AGENT_REGISTRY:" $AGENT_REGISTRY
echo "APP_PACKAGE_ID": $APP_PACKAGE_ID

# this calls the update_pcrs onchain with the enclave cap and built PCRs, this can be reused to update PCRs if Rust server code is updated
sui client call --function update_pcrs --module enclave --package $ENCLAVE_PACKAGE_ID --type-args "$APP_PACKAGE_ID::$MODULE_NAME::$OTW_NAME" --args $ENCLAVE_CONFIG_OBJECT_ID $CAP_OBJECT_ID 0x$PCR0 0x$PCR1 0x$PCR2

# # # this script calls the get_attestation endpoint from your enclave url and use it to calls register_enclave onchain to register the public key, results in the created enclave object
sh register_enclave.sh $ENCLAVE_PACKAGE_ID $APP_PACKAGE_ID $ENCLAVE_CONFIG_OBJECT_ID $ENCLAVE_URL $MODULE_NAME $OTW_NAME

export ENCLAVE_OBJECT_ID=0x721c33d181c88910fb2da99665e1e19ea80dfb371ad0d145628ea00fbde6ab47

# echo "ENCLAVE_OBJECT_ID:" $ENCLAVE_OBJECT_ID

