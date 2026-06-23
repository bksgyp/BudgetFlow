import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class BudgetflowInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 고유 유저네임 정의 
    const username = 'pasun';

    // ==========================================
    // 0. 네트워크 인프라 (서울 리전 기본 VPC 조회)
    // ==========================================
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', {
      isDefault: true,
    });

    // ==========================================
    // 1. Amazon S3 버킷 생성 ( 규칙: 항상 본인의 username으로 시작)
    // ==========================================
    const s3Bucket = new s3.Bucket(this, 'BudgetFlowStorageBucket', {
      // 조교님 지침: 버킷 이름은 반드시 pasun-으로 시작해야 권한 에러가 안 납니다!
      bucketName: `${username}-budgetflow-storage-${this.region}`, 
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, 
    });

    // ==========================================
    // 2. 보안 그룹(Security Group) 설정
    // 규칙: 생성할 때 모든 허용 규칙을 해제(기본 생성)하고, 생성 후에 Ingress Rule 수정하기
    // ==========================================
    
    // 2-a. EC2 서버용 보안 그룹 (인바운드 규칙 없이 깨끗하게 생성)
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'ExpressServerSG', {
      vpc,
      description: 'BudgetFlow Express Server Security Group',
      allowAllOutbound: true, 
    });

    // 생성된 이후에 Ingress Rule을 하나씩 추가
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access'
    );
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3000),
      'Allow Express API access'
    );
    // HTTPS 종단(Caddy + Let's Encrypt)용. 80=ACME HTTP-01 챌린지, 443=HTTPS 서빙.
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP for ACME (Let\u0027s Encrypt) challenge'
    );
    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS (Caddy reverse proxy to Express:3000)'
    );

    // 2-b. RDS 데이터베이스용 보안 그룹
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'PostgreSQLSG', {
      vpc,
      description: 'BudgetFlow PostgreSQL Database Security Group',
    });

    // 제약사항 반영: RDS 5432 포트는 오직 성아님의 EC2 서버에서만 찌를 수 있도록 철통 차단
    rdsSecurityGroup.addIngressRule(
      ec2SecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access only from Express Server'
    );


    // ==========================================
    // 3. Amazon RDS (PostgreSQL) 생성
    // 🚨 규칙: 프리티어 템플릿, EC2 연결 X, 퍼블릭 액세스 허용
    // ==========================================
    const dbInstance = new rds.DatabaseInstance(this, 'BudgetFlowRDS', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO
      ), // db.t3.micro (프리티어 요구사항 충족)
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, // 기본 VPC 퍼블릭 서브넷 배치
      securityGroups: [rdsSecurityGroup],
      databaseName: 'budgetflow',
      credentials: rds.Credentials.fromPassword(
        username, // 데이터베이스 마스터 사용자 이름
        cdk.SecretValue.unsafePlainText('InhaComputerScience2026!') 
      ),
      allocatedStorage: 20,
      maxAllocatedStorage: 20,
      publiclyAccessible: true, //퍼블릭 액세스 허용 설정 완료!
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deleteAutomatedBackups: true,
    });


    // ==========================================
    // 4. Amazon EC2 인스턴스 생성
    // 규칙: t3.micro 범위 준수, 조교님이 미리 만든 인스턴스 프로필 연결
    // ==========================================
    
    // 조교님이 미리 서버에 생성해 둔 전용 EC2 인스턴스 프로필(Role)을 불러옵니다.
    const ec2Role = iam.Role.fromRoleArn(
      this, 
      'ImportedEC2Role', 
      `arn:aws:iam::${this.account}:instance-profile/SafeInstanceProfileForUser-${username}`
    );

    const ec2Instance = new ec2.Instance(this, 'ExpressServerEC2', {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO
      ), // t3.micro (지정 범위 내)
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      keyName: 'budgetflow-key',
      // 조교님 지침: 엑세스 키 발급 대신 제공된 안전한 인스턴스 프로필 매핑 완료!
      role: ec2Role as any, 
    });


    // ==========================================
    // 5. 출력 정보 (Outputs)
    // ==========================================
    new cdk.CfnOutput(this, 'S3BucketName', { value: s3Bucket.bucketName });
    new cdk.CfnOutput(this, 'RDSEndpoint', { value: dbInstance.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'EC2PublicIP', { value: ec2Instance.instancePublicIp });
  }
}