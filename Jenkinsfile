
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
    }

    post {
        success {
            echo 'Image successfully built and pushed to ECR!'
            echo "Image: ${ECR_IMAGE}:${BUILD_NUMBER}"
        }

        failure {
            echo 'Pipeline failed. Check console output.'
        }

        always {
            echo "Build number: ${BUILD_NUMBER}"
        }
    }
}
