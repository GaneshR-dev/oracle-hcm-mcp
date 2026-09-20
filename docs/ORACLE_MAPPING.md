# Oracle HCM REST mapping (official 11.13.18.05 only)

Unofficial MCP mapping. **Not** a complete ADF catalog.
Docs: https://docs.oracle.com/en/cloud/saas/human-resources/farws/rest-endpoints.html

Resources: `{ORACLE_HCM_BASE_URL}/resources/11.13.18.05/{collection}`
Atom: `{ORACLE_HCM_BASE_URL}/atomservlet/{workspace}/{collection}` (not under `resources/`)

| MCP domain | Official Fusion path |
|------------|----------------------|
| workers | `workers`, `workers/{id}` |
| assignments | `workers/{id}?expand=workRelationships.assignments` and nested `…/child/workRelationships/{wr}/child/assignments/{asg}` |
| emails / phones / NIDs / legislative | `workers/{id}/child/{emails\|phones\|nationalIdentifiers\|legislativeInfo}` |
| addresses / names / photos / visas / passports / … | `workers/{id}/child/{addresses\|names\|photos\|citizenships\|visasPermits\|passports\|disabilities\|driverLicenses\|ethnicities\|religions\|externalIdentifiers\|otherCommunicationAccounts\|messages}` |
| assignment grade steps | `workers/{id}/child/workRelationships/{wr}/child/assignments/{asg}/child/gradeSteps` |
| absences | `absences`; projected balance `POST absences/action/loadProjectedBalance` |
| plan balances | `planBalances` finder `findByBalanceAsOfDate` |
| absence LOVs | `absenceTypesLOV`, `absencePlansLOV` |
| AOR | `areasOfResponsibility` |
| checklists | `allocatedChecklists`; `POST …/action/allocateChecklist`; tasks `child/allocatedTasks` + `action/updateTaskStatus` |
| BP notifications | `businessProcessNotifications` + `POST …/action/performAction` |
| orgs / jobs / grades / positions | `organizations`, `jobs`, `grades`, `positions`, `jobFamilies`; LOVs `jobsLov`, `gradesLov`, `gradeLaddersLov`, `gradeRatesLOV`, `locationsLov` |
| locations | `locations` and `locationsV2` |
| time | `timeRecordGroups` + `child/timeRecords`; submit `POST timeRecordEventRequests`; clock `timeEventRequests` |
| schedules | `workforceScheduleDefinitions` |
| talent profiles | `talentPersonProfiles` |
| payroll | `payrollRelationships` (read); costing `assignmentCosting` / `payrollRelationshipCosting` |
| recruiting | `recruitingJobRequisitions` (+ `child/{skills\|attachments\|publishedJobs}`), `recruitingCandidates` (+ `child/{attachments\|citizenships}`), `recruitingJobOffers` |
| benefits | `benefitEnrollments` (+ `child/{dependents\|costs\|providers}`); LOV `lifeEventsLOV` |
| goals | `goalPlans` + `child/performanceGoals` |
| performance | `performanceEvaluations`, `checkInDocuments` |
| learning | `learnerLearningRecords` + `child/completionDetails` |
| journeys | `workerJourneys` + `child/tasks`, `workerJourneyTasks` |
| documents | `documentRecords`; actions `downloadAttachments`, `generateDraftLetter`, `findByAdvancedSearchQuery` |
| compensation | `salaries`, `salaryBasisLov`, `gradeStepsLOV` (SENSITIVE) |
| payslips / payment methods | `payslips`, `personalPaymentMethods` (SENSITIVE) |
| Atom CDC | `/hcmRestApi/atomservlet/employee/{newhire\|empassignment\|empupdate\|payupdate\|termination\|workrelshipupdate}` and `workstructures/{grades\|jobs\|locations\|positions\|position}` |

## Dropped (no public HCM REST equivalent)

Invented collections/actions are **not** allowlisted; dummy **404**s them:

- `atomfeeds` as a `resources/` root (use atomservlet)
- `workerAssignments`, `timeRecords`, `timeCards`, `workSchedules`
- `bankAccounts` (FSCM `externalBankAccounts` — out of HCM)
- `reviewCycles`, `performanceFeedback`, `otbiReports`
- `recruitingInterviews`
- `absencePlans` as a collection (`absencePlansLOV` is the official LOV)
- `benefitEnrollments/action/enroll` / `optOut`
- `timeCards/action/validate\|submit`
- `absences/action/previewEntitlement` (use `loadProjectedBalance`)
- `planBalances/action/byDate` (use finder `findByBalanceAsOfDate`)
- `allocatedChecklists/.../action/forceClose`

MCP **tool names** stay stable where a Fusion equivalent exists; only internals were remapped.

Field names and finders vary by Fusion release. The MCP client sends JSON as provided.

**Schema:** official ADF `GET {collection}/describe` (not GraphQL). Catalog: `GET /describe?metadataMode=minimal`. OpenAPI: `Accept: application/vnd.oracle.openapi3+json`. See [ADF_SCHEMA.md](ADF_SCHEMA.md).

Auth: Basic, OAuth client-credentials, Bearer. HCM **RBAC** always applies on the real server.
