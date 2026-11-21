#!/usr/bin/env bash
# Retries creating the Always Free A1 instance until Oracle has capacity.
# Run it in Oracle Cloud Shell (console → terminal icon, top right); the OCI CLI there is already signed in.
#
#   1. Fill in the four values below (how to find them is in DEPLOY-ORACLE.md, step 3b).
#   2. Paste your SSH *public* key (the .pub file Oracle gave you) into SSH_PUBLIC_KEY.
#   3. bash oracle-retry-launch.sh
#
# Keep the Cloud Shell tab open. The script tries every 5 minutes and stops as soon as the instance is created.
set -u

COMPARTMENT_OCID="ocid1.tenancy.oc1..aaaaaaaa7qrripynweumzoxyybhzkqkpow2b6ow2bcwtuorkw55eepgflhha"        # Tenancy OCID (Profile → Tenancy → OCID)
SUBNET_OCID="ocid1.subnet.oc1.ap-hyderabad-1.aaaaaaaaode7ncziikspx3rzvzrvf2ax3z5vwlmzvrzbzloiy3jixe2guwcq" # filomina-vcn → Subnets → public subnet → OCID
SSH_PUBLIC_KEY="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7QQoUULH3d0V54WfpvGVMWIoQzhnzLd64htHpXjPqkfynDXQM22V012T38EFMwIMoLVB5AZ1ZWE6X7bt1yd15TOs5AxmVVcVYjH4BQodUTOmG5ETKgx07FMtyRd3HK+qt9vAa/k9MT+sZJG57qB3R7OH3iUgWWXoS4u1hnwKNcMVi9KyXNN+b6rR9QfLjjM/8n4bpEehKkS4GnmLcuTVKR1X9JikWriywLHFknaSgmOl+E0/b2fWCYPfKZEeskqRxVsxq3wO10DRDAS2RnYpbR1ZfbK4Of3CxzhumVCzREqzFENgTENeHnYhQpyOHRaHZftTJDVmkAvcN8qwgB+7L ssh-key-2026-10-20"    # contents of the .pub file, one line
OCPUS=4            # try 4; if it never succeeds, lower to 2 (12 GB) – still free
MEMORY_GB=24
BOOT_GB=100
NAME="filomina"

# Ubuntu 24.04 ARM image in this region (looked up automatically)
IMAGE_OCID=$(oci compute image list --compartment-id "$COMPARTMENT_OCID" --operating-system "Canonical Ubuntu" --operating-system-version "24.04" --shape "VM.Standard.A1.Flex" --sort-by TIMECREATED --sort-order DESC --query 'data[0].id' --raw-output)
# Availability domains of the region (Hyderabad has one)
ADS=$(oci iam availability-domain list --compartment-id "$COMPARTMENT_OCID" --query 'data[].name' --raw-output | tr -d '[]",' )

echo "image: $IMAGE_OCID"
echo "availability domains: $ADS"
attempt=0
while true; do
  attempt=$((attempt + 1))
  for AD in $ADS; do
    echo "$(date '+%F %T') attempt $attempt in $AD …"
    if oci compute instance launch \
        --availability-domain "$AD" \
        --compartment-id "$COMPARTMENT_OCID" \
        --shape "VM.Standard.A1.Flex" \
        --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
        --image-id "$IMAGE_OCID" \
        --subnet-id "$SUBNET_OCID" \
        --assign-public-ip true \
        --display-name "$NAME" \
        --boot-volume-size-in-gbs "$BOOT_GB" \
        --metadata "{\"ssh_authorized_keys\": \"$SSH_PUBLIC_KEY\"}" \
        --query 'data.{id:id,state:"lifecycle-state"}' --output table; then
      echo "$(date '+%F %T') SUCCESS – instance is being provisioned. Open Compute → Instances for the public IP."
      exit 0
    fi
  done
  sleep 300
done
