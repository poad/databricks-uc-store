import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class AwsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const externalId = this.node.tryGetContext('external-id') || undefined;

    const bucketName = `databricks-unity-catalog-store-${this.account}`;
    const bucket = new s3.Bucket(this, 'Bucket', {
      bucketName,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      accessControl: s3.BucketAccessControl.PRIVATE,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const roleName = 'databricks-external-storage-role';
    const assumedBy = externalId ? new iam.CompositePrincipal(
      new iam.ArnPrincipal('arn:aws:iam::414351767826:role/unity-catalog-prod-UCMasterRole-14S5ZJVKOTYTL'),
      new iam.ArnPrincipal(`arn:aws:iam::${this.account}:role/${roleName}`),
    ).withConditions({
      'StringEquals': {
        'sts:ExternalId': externalId,
      },
    }) : new iam.ArnPrincipal('arn:aws:iam::414351767826:role/unity-catalog-prod-UCMasterRole-14S5ZJVKOTYTL').withConditions({
      'StringEquals': {
        'sts:ExternalId': '0000',
      },
    });

    const role = new iam.Role(this, 'Role', {
      roleName,
      assumedBy,
      inlinePolicies: {
        's3-bucket-access': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
                's3:GetBucketLocation',
                's3:GetLifecycleConfiguration',
                's3:PutLifecycleConfiguration',
              ],
              resources: [
                bucket.bucketArn,
                `${bucket.bucketArn}/*`,
              ],
            }),
          ],
        }),
        'assume-role-access': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                'sts:AssumeRole',
              ],
              resources: [
                `arn:aws:iam::${this.account}:role/${roleName}`,
              ],
            }),
          ],
        }),
      },
    });

    new cdk.CfnOutput(this, 'OutputRoleArn', {
      key: 'RoleArn',
      value: role.roleArn,
    });
    new cdk.CfnOutput(this, 'OutputBucketName', {
      key: 'BucketName',
      value: bucketName,
    });
  }
}
