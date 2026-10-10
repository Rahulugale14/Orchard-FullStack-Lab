
pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        CI = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Environment Check') {
            steps {
                bat 'node --version'
                bat 'npm --version'
                bat 'git --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Install Playwright Browser') {
            steps {
                bat 'npx playwright install chromium'
            }
        }

        stage('Quality Gates') {
            steps {
                bat 'npm run typecheck'
                bat 'npm run lint'
                bat 'npm run format:check'
            }
        }

        stage('Run UI API DB Tests') {
            steps {
                bat 'npm test'
            }
        }
    }

    post {
        always {
            archiveArtifacts(
                artifacts: 'playwright-report/**,allure-results/**,test-results/**',
                allowEmptyArchive: true
            )
        }

        success {
            echo 'Playwright pipeline completed successfully.'
        }

        failure {
            echo 'Build failed. Check the stage and console output.'
        }

        cleanup {
            cleanWs()
        }
    }
}

