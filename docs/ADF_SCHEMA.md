# ADF schema (official Fusion HCM metadata)

Unofficial MCP notes. **Not** an Oracle product.

Fusion Cloud HCM schema is **ADF REST `/describe`**, not GraphQL.

Official docs:

- [Access Metadata](https://docs.oracle.com/en/cloud/saas/human-resources/farws/Access_Metadata.html)
- [Query a collection](https://docs.oracle.com/en/cloud/saas/human-resources/farws/Query_a_Collection.html)
- Common features (OpenAPI Accept): [Access Metadata (FARCA)](https://docs.oracle.com/en/cloud/saas/applications-common/26b/farca/Access_Metadata.html)

## Describe URLs (11.13.18.05)

| Kind | Method | Path |
|------|--------|------|
| Resource | GET | `/hcmRestApi/resources/11.13.18.05/{collection}/describe` |
| Nested child | GET | `/hcmRestApi/resources/11.13.18.05/{parent}/{id}/child/{child}/describe` |
| Catalog (minimal) | GET | `/hcmRestApi/resources/11.13.18.05/describe?metadataMode=minimal` |
| Catalog (links only) | GET | `/hcmRestApi/resources/11.13.18.05/describe?metadataMode=list` |

Query parameters (catalog, not resource):

- `metadataMode=minimal|list`
- `includeChildren=true|false`
- `showAnnotations=true`

Headers:

- `Content-Type: application/vnd.oracle.adf.resourceitem+json` (typical REST)
- Describe response: `application/vnd.oracle.adf.description+json`
- OpenAPI 3: `Accept: application/vnd.oracle.openapi3+json`

`metadataMode` is **not** valid on a specific resource describe.

## Describe body

```json
{
  "Resources": {
    "workers": {
      "discrColumnType": false,
      "attributes": [
        { "name": "PersonId", "type": "integer", "updatable": true, "mandatory": true, "queryable": true, "allowChanges": "inCreate" }
      ],
      "collection": { "finders": [], "actions": [], "links": [] },
      "item": { "actions": [], "links": [] },
      "children": { "addresses": { "links": [] } },
      "links": []
    }
  }
}
```

Attribute flags: `name`, `type`, `mandatory`, `updatable`, `queryable`, `precision`, `allowChanges`.

Queryable=false fields (example from Oracle: `CorrespondenceLanguage`) **must not** appear in `q=`. Non-queryable → HTTP 400.

## ADF `q=` (REST-Framework-Version ≥ 2)

Operators: `= > < >= <= <> in is null is not null between like not like and or upper`.

Examples (Oracle):

```
q=PersonNumber=1000
q=PersonNumber between 1000 and 1100
q=names.FirstName like '%Ki%'
q=upper(FirstName) = 'KIM'
finder=findByPersonId;PersonId=1564072335
```

MCP: `hcm_adf_describe`, `hcm_adf_catalog`, `hcm_describe_resource` with `live=true`. Dummy serves the same paths.

## GraphQL — not a Fusion HCM API

Oracle Fusion Cloud **HCM does not publish GraphQL**.

| Surface | Official? | Path |
|---------|-----------|------|
| ADF REST | yes | `/hcmRestApi/resources/11.13.18.05/…` |
| ADF describe / OpenAPI | yes | `…/describe` + `Accept: application/vnd.oracle.openapi3+json` |
| SOAP | yes | HCM SOAP catalog |
| SCIM schemas | yes (identity) | `/hcmRestApi/scim/Schemas` |
| Atom | yes | `/hcmRestApi/atomservlet/{workspace}/{collection}` |
| BOSS v1 | yes (REST, Common Features) | `/api/boss/data/objects/ora/…` — **not** GraphQL; HCM workers stay ADF |
| GraphQL | **no** | none |

Name collisions that are **not** Fusion HCM:

- Oracle Database 23ai/26ai GraphQL (SQL/duality views)
- ORDS GraphQL
- Oracle Integration **GraphQL Adapter** (consumes *external* GraphQL)
- Oracle Hospitality GraphQL
- ChilliCream **Fusion** (GraphQL federation product)

This MCP does **not** expose `/graphql`. Dummy 404s those paths.

MCP tool: `hcm_fusion_api_surface`.
