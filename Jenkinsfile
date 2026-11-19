
def runSsmCommand(String remoteCommand, String description) {

    def parameters = groovy.json.JsonOutput.toJson([
        commands: [remoteCommand]
    ])

    echo "Executing on EC2: ${description}"

    withEnv(["SSM_PARAMETERS=${parameters}"]) {
        sh '''
            set -eu

            INSTANCE_ID="i-0d50139bba180eacd"
            REGION="ap-southeast-2"

            COMMAND_ID=$(aws ssm send-command \
                --region "$REGION" \
                --instance-ids "$INSTANCE_ID" \
                --document-name AWS-RunShellScript \
                --parameters "$SSM_PARAMETERS" \
                --query 'Command.CommandId' \
                --output text)

            echo "SSM Command ID: $COMMAND_ID"

            STATUS="Pending"

            for ATTEMPT in $(seq 1 60); do

                STATUS=$(aws ssm get-command-invocation \
                    --region "$REGION" \
                    --command-id "$COMMAND_ID" \
                    --instance-id "$INSTANCE_ID" \
                    --query 'Status' \
                    --output text 2>/dev/null || echo "Pending")

                echo "SSM Status: $STATUS"

                case "$STATUS" in
                    Success|Failed|TimedOut|Cancelled|Cancelling|DeliveryTimedOut|ExecutionTimedOut|Undeliverable|Terminated)
                        break
                        ;;
                esac

                sleep 5
            done

            case "$STATUS" in
                Success|Failed|TimedOut|Cancelled|Cancelling|DeliveryTimedOut|ExecutionTimedOut|Undeliverable|Terminated)
                    ;;
                *)
                    echo "ERROR: SSM polling limit reached."
                    echo "Last status: $STATUS"
                    exit 1
                    ;;
            esac

            echo "===== REMOTE STANDARD OUTPUT ====="

            aws ssm get-command-invocation \
                --region "$REGION" \
                --command-id "$COMMAND_ID" \
                --instance-id "$INSTANCE_ID" \
                --query 'StandardOutputContent' \
                --output text || true

            echo "===== REMOTE ERROR OUTPUT ====="

            aws ssm get-command-invocation \
                --region "$REGION" \
                --command-id "$COMMAND_ID" \
                --instance-id "$INSTANCE_ID" \
                --query 'StandardErrorContent' \
                --output text || true

            if [ "$STATUS" != "Success" ]; then
                echo "ERROR: SSM command failed. Final status: $STATUS"
                exit 1
            fi

            echo "Remote command completed successfully."
        '''
    }
}

pipeline {

    agent any

    environment {

        APP_NAME = 'local-cicd-demo'

        AWS_REGION = 'ap-southeast-2'
        AWS_ACCOUNT_ID = '928844614968'

        ECR_REPOSITORY = 'local-cicd-demo'

        ECR_REGISTRY = '928844614968.dkr.ecr.ap-southeast-2.amazonaws.com'

        ECR_IMAGE = '928844614968.dkr.ecr.ap-southeast-2.amazonaws.com/local-cicd-demo'

        EC2_INSTANCE_ID = 'i-0d50139bba180eacd'

        PATH = '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Applications/Docker.app/Contents/Resources/bin'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout()
    }

    stages {

        // ------------------------------------
        // 1. CHECKOUT
        // ------------------------------------

        stage('Checkout') {
            steps {
                echo 'Checking out latest source code'
                checkout scm
            }
        }

        // ------------------------------------
        // 2. ENVIRONMENT VERIFICATION
        // ------------------------------------

        stage('Environment Verification') {
            steps {
                sh '''
                    set -e

                    echo "===== NODE ====="
                    node --version

                    echo "===== NPM ====="
                    npm --version

                    echo "===== DOCKER ====="
                    docker --version

                    echo "===== AWS CLI ====="
                    aws --version

                    echo "===== AWS IDENTITY ====="
                    aws sts get-caller-identity

                    echo "===== DOCKER INFO ====="
                    docker info
                '''
            }
        }

        // ------------------------------------
        // 3. INSTALL DEPENDENCIES
        // ------------------------------------

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        // ------------------------------------
        // 4. UNIT TESTS
        // ------------------------------------

        stage('Run Unit Tests') {
            steps {
                sh 'npm test'
            }
        }

        // ------------------------------------
        // 5. BUILD AMD64 IMAGE
        // ------------------------------------

        stage('Build AMD64 Docker Image') {
            steps {
                sh '''
                    docker build \
                        --platform linux/amd64 \
                        --pull \
                        -t ${APP_NAME}:${BUILD_NUMBER} .
                '''
            }
        }

        // ------------------------------------
        // 6. ECR AUTHENTICATION
        // ------------------------------------

        stage('Authenticate with ECR') {
            steps {
                sh '''
                    aws ecr get-login-password \
                        --region ${AWS_REGION} \
                    | docker login \
                        --username AWS \
                        --password-stdin ${ECR_REGISTRY}
                '''
            }
        }

        // ------------------------------------
        // 7. TAG IMAGE
        // ------------------------------------

        stage('Tag Docker Image') {
            steps {
                sh '''
                    docker tag \
                        ${APP_NAME}:${BUILD_NUMBER} \
                        ${ECR_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }

        // ------------------------------------
        // 8. PUSH IMAGE
        // ------------------------------------

        stage('Push Image to ECR') {
            steps {
                sh '''
                    docker push ${ECR_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }

        // ------------------------------------
        // 9. VERIFY ECR IMAGE
        // ------------------------------------

        stage('Verify ECR Image') {
            steps {
                sh '''
                    aws ecr describe-images \
                        --repository-name ${ECR_REPOSITORY} \
                        --image-ids imageTag=${BUILD_NUMBER} \
                        --region ${AWS_REGION}
                '''
            }
        }

        // ------------------------------------
        // 10. DEPLOY TO INACTIVE ENVIRONMENT
        // ------------------------------------

        stage('Deploy to Inactive Environment') {
            steps {
                script {

                    def imageUri = "${ECR_IMAGE}:${BUILD_NUMBER}"

                    runSsmCommand(
                        "sudo /usr/local/bin/deploy-blue-green.sh ${imageUri}",
                        "Deploy ${imageUri} to inactive environment"
                    )
                }
            }
        }

        // ------------------------------------
        // 11. PROMOTE PRODUCTION
        // ------------------------------------

        stage('Promote Production') {
            steps {
                script {

                    runSsmCommand(
                        "sudo /usr/local/bin/promote-blue-green.sh ${BUILD_NUMBER}",
                        "Promote version ${BUILD_NUMBER}"
                    )

                    echo "Production promotion completed."
                }
            }
        }

        // ------------------------------------
        // 12. INDEPENDENT PRODUCTION VERIFY
        // ------------------------------------

        stage('Independent Production Verification') {
            steps {
                script {

                    def verifyCommand = """
                        set -eu

                        echo "===== PRODUCTION HEALTH ====="

                        curl -fsS --max-time 10 http://127.0.0.1/health

                        echo

                        echo "===== PRODUCTION VERSION ====="

                        ACTUAL_VERSION=\$(curl -fsS --max-time 10 http://127.0.0.1/ | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')

                        echo "Expected version: ${BUILD_NUMBER}"
                        echo "Actual version: \$ACTUAL_VERSION"

                        if [ "\$ACTUAL_VERSION" != "${BUILD_NUMBER}" ]; then
                            echo "ERROR: Production version mismatch."
                            exit 1
                        fi

                        echo "Production verification successful."
                    """

                    runSsmCommand(
                        verifyCommand,
                        "Independently verify production version ${BUILD_NUMBER}"
                    )
                }
            }
        }
    }

    // ------------------------------------
    // POST BUILD ACTIONS
    // ------------------------------------

    post {

        success {
            echo '======================================'
            echo 'CI/CD DEPLOYMENT COMPLETED SUCCESSFULLY'
            echo "Deployed image: ${ECR_IMAGE}:${BUILD_NUMBER}"
            echo 'Production health: UP'
            echo '======================================'
        }

        failure {
            echo '======================================'
            echo 'PIPELINE FAILED'
            echo 'Check the Jenkins console output.'
            echo 'If promotion failed, check the automatic rollback logs.'
            echo '======================================'
        }

        always {
            echo "Build number: ${BUILD_NUMBER}"
            echo "Pipeline result: ${currentBuild.currentResult}"
        }
    }
}
