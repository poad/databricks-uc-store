import * as pulumi from "@pulumi/pulumi";
import * as databricks from "@pulumi/databricks";

const config = new pulumi.Config("databricks-external-storage");
const me = await databricks.getCurrentUser({});

const storageCredential = new databricks.StorageCredential("external", {
  name: config.require("storage-credential-name"),
  awsIamRole: {
    roleArn: config.requireSecret("role-arn"),
  },
  skipValidation: true,
  comment: "Managed by Pulumi",
});

storageCredential.awsIamRole.apply((a) => {
  pulumi.log.info(`ExternalId: ${a?.externalId}`);
});

new databricks.Grants("external_creds", {
  storageCredential: storageCredential.id,
  grants: [{
    principal: me.userName,
    privileges: ["CREATE_EXTERNAL_TABLE"],
  }],
});

const bucketName = config.requireSecret("bucket-name");
export const locationUrl = pulumi.secret(
  pulumi.interpolate`s3://${bucketName}`
);
const externalLocation = new databricks.ExternalLocation("external", {
  name: "default",
  url: locationUrl,
  credentialName: storageCredential.id,
  comment: "Managed by Pulumi",
});
new databricks.Grants("external", {
  externalLocation: externalLocation.id,
  grants: [{
    principal: me.userName,
    privileges: [
      "CREATE_EXTERNAL_TABLE",
      "READ_FILES",
    ],
  }],
});

// stack output としても export
export const externalId = storageCredential.awsIamRole.apply(r => r?.externalId);
