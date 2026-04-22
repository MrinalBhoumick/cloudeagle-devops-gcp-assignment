// sync-service – CI/CD (Spring Boot + Docker + GCP Artifact Registry + Cloud Run)
// Set in Jenkins job: GAR_PROJECT (e.g. project-15d206fe-12aa-4854-8f0) and optional CLOUDRUN_PROJECT
// Create credential: gcp-sa-jenkins (service account JSON) with Artifact Registry Writer + Cloud Run Admin (scoped)

pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '30'))
    disableConcurrentBuilds()
  }

  environment {
    GAR_LOC        = 'us-central1'
    GAR_REPO       = 'sync-service'
    // GIT_SHA_SHORT + DOCKER_IMAGE set after checkout
  }

  parameters {
    booleanParam(name: 'RUN_DEPLOY', defaultValue: true, description: 'Run deploy after image push (uncheck for build-only).')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA_SHORT = sh(returnStdout: true, script: 'git rev-parse --short=12 HEAD').trim()
          env.GAR_PROJECT = env.GAR_PROJECT ?: null
        }
      }
    }

    stage('Init') {
      steps {
        script {
          if (!env.GAR_PROJECT) {
            error('Set GAR_PROJECT in the Jenkins job environment (GCP project for Artifact Registry / deploy).')
          }
          env.CLOUDRUN_PROJECT = env.CLOUDRUN_PROJECT ?: env.GAR_PROJECT
          if (env.BRANCH_NAME == 'main') {
            env.TARGET_ENV = 'prod'
            env.CLOUDRUN_SERVICE = 'sync-service-prod'
            env.CLOUDRUN_REGION = 'us-central1'
          } else if (env.BRANCH_NAME == 'develop') {
            env.TARGET_ENV = 'qa'
            env.CLOUDRUN_SERVICE = 'sync-service-qa'
            env.CLOUDRUN_REGION = 'us-central1'
          } else if (env.BRANCH_NAME ==~ /^release\/.+/) {
            env.TARGET_ENV = 'staging'
            env.CLOUDRUN_SERVICE = 'sync-service-staging'
            env.CLOUDRUN_REGION = 'us-central1'
          } else {
            env.TARGET_ENV = 'none'
            env.CLOUDRUN_SERVICE = ''
          }
          env.DOCKER_IMAGE = "${GAR_LOC}-docker.pkg.dev/${GAR_PROJECT}/${GAR_REPO}/sync-service"
        }
        echo "Branch=${env.BRANCH_NAME} -> env=${env.TARGET_ENV} image=${env.DOCKER_IMAGE}:${env.GIT_SHA_SHORT}"
      }
    }

    stage('Build & test (Maven)') {
      when { expression { return fileExists('pom.xml') } }
      steps {
        sh 'mvn -B clean verify -DskipITs'
        junit testResults: '**/target/surefire-reports/*.xml', allowEmptyResults: true
      }
    }

    stage('Build & test (Gradle)') {
      when {
        allOf {
          expression { return !fileExists('pom.xml') }
          expression { return fileExists('build.gradle') || fileExists('build.gradle.kts') }
        }
      }
      steps {
        sh 'chmod +x gradlew 2>/dev/null || true'
        sh './gradlew test --no-daemon 2>/dev/null || gradle test --no-daemon'
        junit testResults: '**/build/test-results/test/*.xml', allowEmptyResults: true
      }
    }

    stage('Build Docker image') {
      when {
        anyOf {
          branch 'main'
          branch 'develop'
          expression { env.BRANCH_NAME ==~ /^release\/.+/ }
        }
      }
      steps {
        sh "docker build -t ${env.DOCKER_IMAGE}:${env.GIT_SHA_SHORT} -t ${env.DOCKER_IMAGE}:build-${env.BUILD_NUMBER} ."
      }
    }

    stage('Push to Artifact Registry') {
      when {
        anyOf {
          branch 'main'
          branch 'develop'
          expression { env.BRANCH_NAME ==~ /^release\/.+/ }
        }
      }
      steps {
        withCredentials([file(credentialsId: 'gcp-sa-jenkins', variable: 'GOOGLE_APPLICATION_CREDENTIALS')]) {
          sh '''
            gcloud auth activate-service-account --key-file "$GOOGLE_APPLICATION_CREDENTIALS"
            gcloud config set project $GAR_PROJECT
            gcloud auth configure-docker $GAR_LOC-docker.pkg.dev --quiet
          '''
          sh "docker push ${env.DOCKER_IMAGE}:${env.GIT_SHA_SHORT}"
          sh "docker push ${env.DOCKER_IMAGE}:build-${env.BUILD_NUMBER}"
        }
      }
    }

    stage('Deploy QA / Staging (Cloud Run)') {
      when {
        allOf {
          expression { return params.RUN_DEPLOY }
          anyOf { branch 'develop'; expression { env.BRANCH_NAME ==~ /^release\/.+/ } }
        }
      }
      steps {
        withCredentials([file(credentialsId: 'gcp-sa-jenkins', variable: 'GOOGLE_APPLICATION_CREDENTIALS')]) {
          sh '''
            gcloud auth activate-service-account --key-file "$GOOGLE_APPLICATION_CREDENTIALS"
            gcloud config set project $CLOUDRUN_PROJECT
          '''
          sh """
            gcloud run deploy ${env.CLOUDRUN_SERVICE} \
              --image ${env.DOCKER_IMAGE}:${env.GIT_SHA_SHORT} \
              --region ${env.CLOUDRUN_REGION} \
              --platform managed \
              --quiet
          """
        }
      }
    }

    stage('Production approval') {
      when {
        allOf {
          branch 'main'
          expression { return params.RUN_DEPLOY }
        }
      }
      steps {
        input(
          message: 'Approved to deploy sync-service to PRODUCTION?',
          ok: 'Deploy to prod',
          submitterParameter: 'APPROVER'
        )
        echo "Approved by: ${env.APPROVER}"
      }
    }

    stage('Deploy Production (Cloud Run)') {
      when {
        allOf {
          branch 'main'
          expression { return params.RUN_DEPLOY }
        }
      }
      steps {
        withCredentials([file(credentialsId: 'gcp-sa-jenkins', variable: 'GOOGLE_APPLICATION_CREDENTIALS')]) {
          sh '''
            gcloud auth activate-service-account --key-file "$GOOGLE_APPLICATION_CREDENTIALS"
            gcloud config set project $CLOUDRUN_PROJECT
          '''
          sh """
            gcloud run deploy ${env.CLOUDRUN_SERVICE} \
              --image ${env.DOCKER_IMAGE}:${env.GIT_SHA_SHORT} \
              --region ${env.CLOUDRUN_REGION} \
              --platform managed \
              --quiet
          """
        }
      }
    }

    stage('Post-deploy smoke (optional)') {
      when {
        allOf {
          expression { return params.RUN_DEPLOY }
          expression { return env.TARGET_ENV != 'none' }
        }
      }
      steps {
        sh 'echo "Add: CLOUDRUN_URL from gcloud run services describe; curl -fsS \${URL}/actuator/health"'
      }
    }
  }

  post {
    failure {
      echo 'Rollback: gcloud run services update-traffic SERVICE --to-revisions PREVIOUS_REVISION=100 --region REGION'
    }
  }
}
