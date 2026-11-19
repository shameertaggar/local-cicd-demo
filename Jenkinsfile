
pipeline {
    agent any

    environment {
        APP_NAME = 'local-cicd-demo'
        AWS_REGION = 'ap-southeast-2'
        AWS_ACCOUNT_ID = '928844614968'
        ECR_REPOSITORY = 'local-cicd-demo'

        ECR_REGISTRY = '928844614968.dkr.ecr.ap-southeast-2.amazonaws.com'
        ECR_IMAGE = '928844614968.dkr.ecr.ap-southeast-2.amazonaws.com/local-cicd-demo'

        PATH = '/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Applications/Docker.app/Contents/Resources/bin'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout()
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out latest source code'
                checkout scm
            }
        }

        stage('Environment Verification') {
            steps {
                sh '''
                    node --version
                    npm --version
                    docker --version
                    aws --version

                    aws sts get-caller-identity
                    docker info
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Run Unit Tests') {
            steps {
                sh 'npm test'
            }
        }

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

        stage('Tag Docker Image') {
            steps {
                sh '''
                    docker tag \
                      ${APP_NAME}:${BUILD_NUMBER} \
                      ${ECR_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }

        stage('Push Image to ECR') {
            steps {
                sh '''
                    docker push ${ECR_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }

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


        stage('Deploy to Inactive Environment') {
            steps {
                script {
                    def imageUri = "${ECR_IMAGE}:${BUILD_NUMBER}"

                    def commandId = sh(
                        script: """
                            PARAMETERS=\$(printf '{"commands":["sudo /usr/local/bin/deploy-blue-green.sh ${imageUri}"]}')

                            aws ssm send-command \
                            --region ${AWS_REGION} \
                            --instance-ids i-0d50139bba180eacd \
                            --document-name AWS-RunShellScript \
                            --parameters "\$PARAMETERS" \
                            --query 'Command.CommandId' \
                            --output text
                        """,
                        returnStdout: true
                    ).trim()

                    echo "SSM Command ID: ${commandId}"

                    sh """
                        aws ssm wait command-executed \
                        --region ${AWS_REGION} \
                        --command-id ${commandId} \
                        --instance-id i-0d50139bba180eacd

                        aws ssm get-command-invocation \
                        --region ${AWS_REGION} \
                        --command-id ${commandId} \
                        --instance-id i-0d50139bba180eacd \
                        --query 'StandardOutputContent' \
                        --output text
                    """
                }
            }
        }

    }

    post {
        success {
            echo 'CI/CD deployment completed successfully!'
            echo "Deployed image: ${ECR_IMAGE}:${BUILD_NUMBER}"
            echo 'Application: http://54.253.130.88'
        }

        failure {
            echo 'Pipeline failed. Check console output.'
        }

        always {
            echo "Build number: ${BUILD_NUMBER}"
        }
    }
}
