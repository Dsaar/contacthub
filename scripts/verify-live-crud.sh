#!/usr/bin/env bash
# Run manually against the local API. Only use the ID returned by this run's create.
set -euo pipefail
command -v jq >/dev/null
base=http://127.0.0.1:3000/api/contacts
email="contacthub-$(node -p 'crypto.randomUUID()')@example.com"
json=(-H 'Content-Type: application/json')
http=(curl -q --noproxy '*' --silent --show-error --fail)

created=$("${http[@]}" "${json[@]}" --data "$(jq -nc --arg email "$email" \
  '{firstName:"Alex",lastName:"Demo",company:"ContactHub Demo",email:$email}')" "$base")
id=$(jq -er --arg email "$email" '.contact | select(.primaryEmail == $email and .isSiteMember == false)
  | .id | select(test("^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$"))' <<<"$created")
printf 'Created disposable contact %s (%s)\n' "$id" "$email"

read_fixture() {
  "${http[@]}" "$base/$id" | jq -ec --arg id "$id" --arg email "$email" \
    '.contact | select(.id == $id and .primaryEmail == $email and .isSiteMember == false)'
}
before=$(read_fixture)
revision=$(jq -er '.revision | numbers' <<<"$before")
patch=$(jq -nc --argjson rev "$revision" '{revision:$rev,jobTitle:"Test Engineer"}')
updated=$("${http[@]}" -X PATCH "${json[@]}" --data "$patch" "$base/$id")
jq -e --arg id "$id" --argjson rev "$revision" \
  '.contact | .id == $id and .revision > $rev and .jobTitle == "Test Engineer"' <<<"$updated" >/dev/null

after=$(read_fixture)
jq -e '.firstName == "Alex" and .lastName == "Demo" and .company == "ContactHub Demo" and .jobTitle == "Test Engineer"' \
  <<<"$after" >/dev/null
status=$("${http[@]}" -X DELETE -o /dev/null -w '%{http_code}' "$base/$id")
[[ "$status" == 204 ]]
status=$(curl -q --noproxy '*' --silent --show-error -o /dev/null -w '%{http_code}' "$base/$id")
[[ "$status" == 404 ]]
printf 'Verified create, retrieve, update, delete (204), and subsequent lookup (404).\n'
