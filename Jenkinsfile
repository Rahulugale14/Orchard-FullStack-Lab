pipeline {
  agent {
    docker {
      image 'mcr.microsoft.com/playwright:v1.64.0-noble'
      args '--user root'
    }
  }
  options {
    timeout(time: 20, unit: 'MINUTES')
    timestamps()
    disableConcurrentBuilds()
  }
  environment {
    CI = 'true'
  }
  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Install') {
      steps { sh 'npm ci' }
    }
    stage('Quality gates') {
      steps {
        sh 'npm run typecheck'
        sh 'npm run lint'
        sh 'npm run format:check'
      }
    }
    stage('Playwright tests') {
      steps { sh 'npm test' }
    }
  }
  post {
    always {
      junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'playwright-report/**,allure-results/**,test-results/**'
    }
    cleanup {
      cleanWs()
    }
  }
}
