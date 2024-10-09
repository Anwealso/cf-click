![CF-CLICK Banner](banner_narrow.jpg)

An extension to jump to files in ColdFusion.

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

## Known Bugs

- **[FIXED]** On click, extension cannot find the correct file to open in most path cases
- **[FIXED]** The link highlight in the code highlights the whole section of code matched by the regex (i.e. the whole tag) - not just the "capture" (i.e. just the filename) portion of the regex as desired. When fixed this will make the code highlighting less inrusive and give the user a better signifier that they are following the file link specifically
- Bugs in cfquery table name linking:
  - Currently only works for the first table in query (the one straight after the FROM operator)
