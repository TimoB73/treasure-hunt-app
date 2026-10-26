#!/usr/bin/env bash
# Einmalige Einrichtung: GitHub Actions darf die Cloud Functions und Firestore-Regeln deployen.
# Verfahren: Workload Identity Federation – Google vertraut GitHub direkt, es gibt keinen Schlüssel.
# Zugelassen ist nur das Repo TimoB73/treasure-hunt-app und nur der Branch main.
# Das Skript kann gefahrlos mehrfach ausgeführt werden.
set -euo pipefail

PROJECT=schatzsuche-d5d97
PROJECT_NUMBER=21635380668
REPO=TimoB73/treasure-hunt-app
SA_NAME=github-deploy
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
POOL=github
PROVIDER=github

echo "1/5 Benötigte Google-Dienste einschalten …"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com --project "$PROJECT"

echo "2/5 Dienstkonto $SA_NAME anlegen …"
if ! gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" --display-name "GitHub Deploy (Cloud Functions)"
fi

# Ein neues Dienstkonto ist bei Google erst nach einigen Sekunden überall bekannt – daher bis zu 5× versuchen
grant() {
  for attempt in 1 2 3 4 5; do
    if gcloud projects add-iam-policy-binding "$PROJECT" \
      --member "serviceAccount:$SA" --role "$1" --condition=None --quiet >/dev/null 2>&1; then
      return 0
    fi
    echo "   … Dienstkonto noch nicht bereit, warte 15 Sekunden (Versuch $attempt/5)"
    sleep 15
  done
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$1" --condition=None --quiet >/dev/null
}

echo "3/5 Rechte zum Deployen vergeben …"
for role in \
  roles/firebase.admin \
  roles/cloudfunctions.admin \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.admin \
  roles/secretmanager.admin \
  roles/serviceusage.serviceUsageConsumer \
  roles/cloudbuild.builds.editor; do
  grant "$role"
  echo "   ✔ $role"
done

echo "4/5 Vertrauensstellung zu GitHub einrichten …"
if ! gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" --location global --display-name "GitHub"
fi
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJECT" --location global \
  --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" --location global \
    --workload-identity-pool "$POOL" --display-name "GitHub Actions" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository=='$REPO' && assertion.ref=='refs/heads/main'"
fi

echo "5/5 GitHub erlauben, das Dienstkonto zu nutzen …"
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" \
  --quiet >/dev/null

echo
echo "✔ Fertig. GitHub kann jetzt nach jedem Merge die Cloud Functions deployen."
