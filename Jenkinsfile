
pipeline {

    agent any

    environment {
        APP_NAME = 'local-cicd-demo'

        // Ensure Jenkins can find Homebrew and Docker CLI
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
                    echo "Checking installed tools"

                    node --version
                    npm --version
                    docker --version

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

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build \
                      --pull \
                      -t ${APP_NAME}:${BUILD_NUMBER} .
                '''
            }
        }

        stage('Deploy Locally') {
            steps {
                sh '''
                    chmod +x scripts/deploy-local.sh

                    ./scripts/deploy-local.sh
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    echo "Checking deployed application"

                    curl --fail \
                      --retry 5 \
                      --retry-delay 2 \
                      http://localhost:3000/health

                    echo "Deployment verified successfully"
                '''
            }
        }
    }

    post {

        success {
            echo 'CI/CD pipeline completed successfully!'
            echo 'Application: http://localhost:3000'
        }

        failure {
            echo 'CI/CD pipeline failed!'
            echo 'Check the Jenkins console output.'
        }

        always {
            echo "Build number: ${BUILD_NUMBER}"
        }
    }
}
