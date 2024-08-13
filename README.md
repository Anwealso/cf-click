# CF-CLICK

An extension to jump to files in CF.

---

## Desired Features

- `<cfinclude>`
    - Click the path in the `template="MyPage.cfm"` argument to jump to the listed `CF_PROJ_PATH/.../<MyPage>.cfm` file
- `<cfmodule>`
    - Click the path in the `template="MyPage.cfm"` argument to jump to the listed `CF_PROJ_PATH/.../<MyPage>.cfm` file
- `<cfinvoke>`
    - Click the path in the `component="MyComponent"` argument to jump to the listed `CF_PROJ_PATH/.../<MyComponent>.cfc` file
    - Click the path in the `method="MyFunction"` argument to jump to the top of `MyFunction` function within the cf file in the paired component arg
- `<cfstoredproc>`
    - Click the path in the `procedure="spMyProcedure"` / `procedure="dbo.spMyProcedure"` argument to jump to the listed sql file (in `DB_PROJ_PATH/dbo/Stored Procedures/spMyProcedure` / `DB_PROJ_PATH/dbo/Stored Procedures/spMyProcedure`)

### Stretch Goals
- `<cfquery>` tag
    - Click the table name in the `FROM TableName` argument to jump to the `TableName.sql` sql file
    - Click the table name in the `JOIN TableName` argument to jump to the `TableName.sql` sql file
- `cfquery` variable name
    - Click the variable name (`<cfquery name="MyQueryName">`) of a the `cfquery` search defined previously in the current file to jump to the definition

## Plugin Settings

- CF project path (`CF_PROJ_PATH`)
- SQL project path (`DB_PROJ_PATH`)