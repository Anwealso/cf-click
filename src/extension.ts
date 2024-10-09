// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import path = require("path");
import * as fs from "fs";

const getProperty = (obj: any, prop: string, deflt?: any) => {
  return obj.hasOwnProperty(prop) ? obj[prop] : deflt;
};
const isString = (obj: any) => typeof obj === "string";
const isObject = (obj: any) => typeof obj === "object";
const isArray = (obj: any) => Array.isArray(obj);
const isUri = (obj: any) => isObject(obj) && obj.hasOwnProperty("scheme");
const convert = (value: any, func: any) => {
  return value !== undefined ? func(value) : value;
};
const convertToNumber = (value: string) =>
  convert(value, (n: string) => Number(n));
const getCaptureGroupNr = (txt: string) => {
  let result = txt.match(/\$(\d+)/);
  if (result == null) {
    return undefined;
  }
  return Number(result[1]);
};
function getExpressionFunction(expr: any) {
  try {
    return Function(`"use strict";return (function calcexpr(position) {
      return ${expr};
    })`)();
  } catch (ex) {
    vscode.window.showErrorMessage("cf-click: Incomplete expression");
  }
}

class RelatedLinksProvider implements vscode.TreeDataProvider<unknown> {
  editor: vscode.TextEditor | undefined;
  private _onDidChangeTreeData: vscode.EventEmitter<unknown>;
  onDidChangeTreeData: vscode.Event<unknown>;
  paths: RelatedPaths;
  content: RelatedLink[] | undefined;
  removePathRE: RegExp;
  constructor() {
    this.editor = undefined;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.paths = new RelatedPaths(undefined);
    this.content = undefined;
    this.removePathRE = new RegExp(".*?[\\\\/](?=[^\\\\/]+$)(.*)");
  }
  refresh() {
    this._onDidChangeTreeData.fire(0);
  }
  setPaths(paths: RelatedPaths) {
    this.paths = paths;
    this.refresh();
  }
  getTreeItem(element: vscode.TreeItem) {
    return element;
  }
  getChildren(element: vscode.TreeItem) {
    if (!this.paths.documentPath) return Promise.resolve([]);
    // when tabs are changed we get multiple 'ChangeTextEditorSelection' events.
    // check for current editor
    let removePathFromLabel = this.paths.removePathFromLabel;
    var links = new Map();
    for (let {
      linkPath,
      lineNr,
      charPos,
      lineSearch,
      filePos,
      filePath,
      label,
      isCurrentFile,
    } of this.paths.paths) {
      let compareStr = linkPath;
      if (
        label === undefined &&
        (lineNr !== undefined || lineSearch !== undefined)
      ) {
        label = `${filePath}`;
        compareStr = label;

        let addNumber = (x: number) => {
          if (!x) return x;
          label += `:${x}`;
          compareStr += `:${String(x).padStart(7, "0")}`;
          return x;
        };
        addNumber(lineSearch);
        addNumber(lineNr);
        addNumber(charPos);

        // // Append the line and col nums to the strings
        // for (let infoNumber of [lineSearch, lineNr, charPos]) {
        //   if (infoNumber) {
        //     label += `:${infoNumber}`;
        //     compareStr += `:${String(infoNumber).padStart(7, "0")}`;
        //   }
        // }
      }
      let key = label || linkPath;
      if (!links.has(key) || filePos < links.get(key).filePos) {
        if (label && removePathFromLabel) {
          label = label.replace(this.removePathRE, "$1");
        }
        links.set(key, {
          linkPath,
          lineNr,
          charPos,
          lineSearch,
          label,
          compareStr,
          filePos,
          isCurrentFile,
        });
      }
    }
    var linksAr = Array.from(links.values());
    let collator = Intl.Collator().compare;
    let compareFunc = this.paths.sortByPosition
      ? (a: any, b: any) => a.filePos - b.filePos
      : (a: any, b: any) => collator(a.compareStr, b.compareStr);
    this.content = linksAr.sort(compareFunc).map((x) => new RelatedLink(x));
    // this.content.push(new vscode.TreeItem({label:'Blablablablabla', highlights:[[0,5],[8,12]]}));
    return Promise.resolve(this.content);
  }
}
class RelatedLink extends vscode.TreeItem {
  constructor(linkObj: {
    linkPath: string;
    lineNr: any;
    charPos: any;
    lineSearch: any;
    isCurrentFile: any;
    label: string | vscode.TreeItemLabel | undefined;
  }) {
    super(vscode.Uri.file(linkObj.linkPath));
    this.command = {
      command: "cf-click.openFile",
      arguments: [
        this.resourceUri,
        linkObj.lineNr,
        linkObj.charPos,
        undefined,
        undefined,
        linkObj.lineSearch,
      ],
      title: "",
    };
    this.iconPath = vscode.ThemeIcon.File;
    this.description = !linkObj.isCurrentFile; // use resource URI if other file
    this.label = linkObj.label; // use label when set
    this.contextValue = linkObj.isCurrentFile ? undefined : "relatedFile"; // used for menu entries
  }
  // @ts-ignore
  get tooltip() {
    return `${this.resourceUri!.fsPath}`;
  }
}
class RelatedPaths {
  documentPath: string | null;
  removePathFromLabel: any;
  paths: any;
  sortByPosition: any;
  include: any;
  constructor(document: vscode.TextDocument | undefined) {
    this.sortByPosition = undefined;
    this.removePathFromLabel = undefined;
    this.include = {};
    this.paths = [];
    this.documentPath = document ? document.uri.fsPath : null;
    if (document) {
      this.getPaths(document);
    }
  }
  getPaths(document: vscode.TextDocument) {
    var workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    var config = vscode.workspace.getConfiguration(
      "cf-click",
      workspaceFolder ? workspaceFolder.uri : null
    );
    var includeConfig: any | undefined = config.get("include");
    var exclude: string[] | RegExp[] | undefined = config.get("exclude");
    var fileroots: string[] = config.get("fileroot")!;

    const stripTrailingSlash = (str: string) => {
      return str.endsWith("/") || str.endsWith("\\") ? str.slice(0, -1) : str;
    };
    fileroots.map((fileroot, i) => {
      fileroots[i] = stripTrailingSlash(fileroot);
    });

    this.sortByPosition = config.get("sortByPosition");
    this.removePathFromLabel = config.get("removePathFromLabel");

    var ownfilePath = document.uri.fsPath;
    var docFolder = path.dirname(ownfilePath);
    var filerootFolders = [docFolder];
    if (workspaceFolder) {
      let workspaceBasePath = workspaceFolder.uri.fsPath;
      for (const fileroot of fileroots) {
        // Man why is this part just giving us .../A (all fucked up)
        let possibleRoot = path.join(workspaceBasePath, fileroot);
        if (
          fs.existsSync(possibleRoot) &&
          !filerootFolders.includes(possibleRoot)
        ) {
          filerootFolders.push(possibleRoot);
        }
      }
    }

    let asDoclink = true;
    this.include = {};
    if (isArray(includeConfig)) {
      if (includeConfig.length > 0) {
        this.updateInclude("all", includeConfig, asDoclink);
      }
    } else {
      if (isObject(includeConfig)) {
        for (const languageId in includeConfig) {
          if (!includeConfig.hasOwnProperty(languageId)) {
            continue;
          }
          if (!(document.languageId === languageId || languageId === "all")) {
            continue;
          }
          this.updateInclude(languageId, includeConfig[languageId], asDoclink);
        }
      }
    }
    if (document.languageId === "html") {
      this.updateInclude(
        document.languageId,
        [
          `<(?:a|img|link|script)[^>]*? (?:src|href)=['"]((?!//|[^:>'"]*:)[^#?>'"]*)(?:[^>'"]*)['"][^>]*>`,
        ],
        !asDoclink
      );
    }

    var docText: string = document.getText();
    this.paths = [];
    for (const languageId in this.include) {
      if (!this.include.hasOwnProperty(languageId)) {
        continue;
      }
      for (const includeObj of this.include[languageId]) {
        // For each regex include pattern
        let linkRE = new RegExp(includeObj.find, "gmi");
        let replaceRE = new RegExp(includeObj.find, "mi"); // needs to be a copy, replace() resets property lastIndex
        let result: RegExpExecArray | null;
        while ((result = linkRE.exec(docText)) != null) {
          // While we found a result to searching the regex pattern in the current document
          // Note: result[0] is the full regex match and result[1] is the capture string of the regex

          if (result.length < 2) continue; // no matching group defined

          let filePath: string = result[0].replace(
            replaceRE,
            includeObj.filePath
          );
          filePath = variableSubstitution(filePath, null, document, false)!;
          if (filePath.length === 0) {
            continue;
          }
          /* ------------------------------------ = ----------------------------------- */
          // Derive the absolute path to the file listed in the code path
          if (filePath === "/") filePath = "/__root__";
          let linkPath = filePath;
          if (!includeObj.isAbsolutePath) {
            // Strip off any #application.root# if needed
            filePath = filePath.replace("#application.root#", "");

            // Need to change this prepending of filerootFolder based on whether the file is app or db
            if (filePath.startsWith("/")) {
              // The path is an absolute path from the repo root
              for (let filerootFolder of filerootFolders) {
                // Test each root folder to check which one this path is absolute from
                linkPath = path.join(filerootFolder, filePath.substring(1));
                if (fs.existsSync(linkPath)) {
                  console.log(
                    `${filePath} is ABSOLUTE path from filerootFolder: ${filerootFolder}`
                  );
                  break;
                }
              }
            } else {
              // The path is a relative path from the curent document dir
              linkPath = path.join(docFolder, filePath);
              if (fs.existsSync(linkPath)) {
                console.log(`${filePath} is RELATIVE path from ${docFolder}`);
              }

              // Also sometimes the path is just a reference to the filename
              // in-general and not a proper relative link, so also just search
              // for any files matching the filename itself in the whole repo.
              if (!fs.existsSync(linkPath)) {
                // TODO: This is very inefficient... probably can be optimised
                for (let filerootFolder of filerootFolders) {
                  const files: string[] | Buffer[] = fs.readdirSync(
                    filerootFolder,
                    { recursive: true }
                  );
                  // Search through all the files under each filerootFolder
                  for (const checkFile of files) {
                    let checkFilePath: string = path.join(
                      filerootFolder,
                      String(checkFile)
                    );

                    // Do any paths in the repo have an end that matches with our search filePath?
                    // If so lets just take the first match lol
                    // Also double check that the path is valid
                    if (
                      checkFilePath.endsWith(filePath) &&
                      fs.existsSync(checkFilePath)
                    ) {
                      linkPath = checkFilePath;
                    }
                  }
                  if (fs.existsSync(linkPath)) {
                    break;
                  }
                }
              }
            }
          }

          // TODO: Remove debug statements
          // linkPath =
          //   "/Users/alexnicholson/coding/projects/cf-click/TestProject/Application/images/house.png";

          // console.log(linkPath);
          // console.log("");

          // Only show the link if the file actually exists
          if (!fs.existsSync(linkPath)) {
            continue;
          }
          /* ------------------------------------ = ----------------------------------- */

          let isCurrentFile = linkPath === ownfilePath;
          if (!includeObj.allowCurrentFile && isCurrentFile) {
            continue;
          }
          // Display the link only over the capture portion of the regex match
          let filePos = result.index + result[0].indexOf(result[1]);
          let filePosEnd = filePos + result[1].length;
          var offset2DisplayPosition = (offset: number) => {
            let position = document.positionAt(offset);
            return {
              line: position.line + 1,
              character: position.character + 1,
            };
          };
          let position = {
            start: offset2DisplayPosition(filePos),
            end: offset2DisplayPosition(filePosEnd),
          };
          let fullRange = new vscode.Range(
            document.positionAt(filePos),
            document.positionAt(filePosEnd)
          );
          if (
            this.paths.some(
              (p: { fullRange: vscode.Range }) =>
                fullRange.intersection(p.fullRange) !== undefined
            )
          ) {
            continue;
          } // regex matching biggest text ranges should be specified first
          // let adjustRange = (txt: string) => {
          //   filePos += result![0].indexOf(txt);
          //   filePosEnd = filePos + txt.length;
          // };
          // if (includeObj.rangeGroup) {
          //   let groupNr = getCaptureGroupNr(includeObj.rangeGroup);
          //   if (groupNr !== undefined && groupNr < result.length) {
          //     adjustRange(result[groupNr]);
          //   }
          // }
          let pathRange = new vscode.Range(
            document.positionAt(filePos),
            document.positionAt(filePosEnd)
          );
          let getNumber = (x: any) => {
            if (!x) return x;
            x = result![0].replace(replaceRE, x);
            return Number(getExpressionFunction(x)(position));
          };
          let lineNr = getNumber(includeObj.lineNr);
          let charPos = getNumber(includeObj.charPos);
          let lineSearch = includeObj.lineSearch;
          if (lineSearch) {
            lineSearch = result[0].replace(replaceRE, lineSearch);
          }
          let label = includeObj.label;
          if (label) {
            label = result[0].replace(replaceRE, label);
          }
          this.paths.push({
            linkPath,
            lineNr,
            charPos,
            lineSearch,
            filePos,
            filePath,
            pathRange,
            fullRange,
            docLink: includeObj.docLink,
            label,
            isCurrentFile,
          });
        }
      }
    }
    if (exclude) {
      var excludeRE = exclude!.map(
        (re: string | RegExp) => new RegExp(re, "mi")
      );
      this.paths = this.paths.filter(
        (x: { linkPath: any }) =>
          !excludeRE.some((r: { test: (arg0: any) => any }) =>
            r.test(x.linkPath)
          )
      );
    }
  }
  updateInclude(languageId: string, list: any[], asDoclink: boolean) {
    if (!isArray(list)) {
      return;
    }
    if (getProperty(this.include, languageId) === undefined) {
      this.include[languageId] = [];
    }
    let includeLanguageArr = this.include[languageId];
    for (const listItem of list) {
      if (isString(listItem)) {
        includeLanguageArr.push({
          find: listItem,
          filePath: "$1",
          lineNr: undefined,
          charPos: undefined,
          docLink: asDoclink,
        });
        continue;
      }
      let find = getProperty(listItem, "find");
      let filePath = getProperty(listItem, "filePath", "$1");
      let isAbsolutePath = getProperty(listItem, "isAbsolutePath");
      let lineSearch = getProperty(listItem, "lineSearch");
      let lineNr = getProperty(listItem, "lineNr");
      let charPos = getProperty(listItem, "charPos");
      let label = getProperty(listItem, "label");
      let allowCurrentFile = getProperty(listItem, "allowCurrentFile");
      let rangeGroup = getProperty(listItem, "rangeGroup");
      asDoclink = getProperty(listItem, "documentLink", asDoclink);
      if (!rangeGroup && !lineNr) {
        let groupNr = getCaptureGroupNr(filePath);
        if (groupNr !== undefined) {
          rangeGroup = "$" + groupNr.toString();
        }
      }
      if (isString(find)) {
        includeLanguageArr.push({
          find,
          filePath,
          lineSearch,
          lineNr,
          charPos,
          isAbsolutePath,
          docLink: asDoclink,
          rangeGroup,
          label,
          allowCurrentFile,
        });
      }
    }
  }
}
function searchText(document: any, text: any) {
  let lineNr = 1;
  let charPos = 1;
  let offset = document.getText().indexOf(text);
  if (offset >= 0) {
    let position = document.positionAt(offset);
    lineNr = position.line + 1;
    charPos = position.character + 1;
  }
  return [lineNr, charPos];
}
class MyDocumentLink extends vscode.DocumentLink {
  linkPath: string;
  lineSearch: string;
  lineNr: number;
  charPos: number;
  constructor(linkObj: {
    pathRange: vscode.Range;
    linkPath: string;
    lineSearch: string;
    lineNr: number;
    charPos: number;
  }) {
    super(linkObj.pathRange);
    this.linkPath = linkObj.linkPath;
    this.lineSearch = linkObj.lineSearch;
    this.lineNr = linkObj.lineNr;
    this.charPos = linkObj.charPos;
  }
}
function revealPosition(
  editor: vscode.TextEditor,
  lineNr: number,
  charPos: number,
  lineSearch: string
) {
  if (!lineNr && !lineSearch) return;
  if (lineSearch) {
    [lineNr, charPos] = searchText(editor.document, lineSearch);
  }
  charPos = charPos || 1;
  let position = new vscode.Position(lineNr - 1, charPos - 1);
  editor.selections = [new vscode.Selection(position, position)];
  editor.revealRange(
    new vscode.Range(position, position),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport
  );
}

function dblQuest(
  value: readonly vscode.WorkspaceFolder[] | undefined,
  deflt: never[]
) {
  return value !== undefined ? value : deflt;
}

var getNamedWorkspaceFolder = (name: string) => {
  const folders = dblQuest(vscode.workspace.workspaceFolders, []);
  let filterPred = (w: { uri: any; name: string }) => w.name === name;
  let index: number | undefined = undefined;
  let wsfLst;
  if (name[0] === "[") {
    index = Number(name.substring(1, name.length - 1));
    let filterPredIndex = (w: { name: string }, idx: number) => idx === index;
    wsfLst = folders.filter(filterPredIndex);
  }
  if (name.indexOf("/") >= 0) {
    filterPred = (w) => w.uri.path.endsWith(name);
  }
  wsfLst = folders.filter(filterPred);
  if (wsfLst.length === 0) {
    vscode.window.showErrorMessage(`Workspace not found with name: ${name}`);
    return undefined;
  }
  return wsfLst[0];
};

function getVariableWithParamsRegex(
  varName: string,
  flags: string | undefined
) {
  return new RegExp(
    `\\$\\{${varName}(\\}|([^a-zA-Z{}$]+)([\\s\\S]+?)\\2\\})`,
    flags
  );
}

class FindProperties {
  find: string;
  replace: string;
  flags: undefined;
  constructor() {
    this.find = "(.*)";
    this.replace = "$1";
    this.flags = undefined;
  }
}

class VariableProperties {
  regexMatch: any;
  name: undefined;
  finds: any[];
  currentFind: any | undefined;
  constructor(regexMatch: any) {
    this.regexMatch = regexMatch;
    this.name = undefined;
    /** @type {FindProperties[]} finds */
    this.finds = [];
    this.currentFind = undefined;
  }
  init() {
    if (this.regexMatch[2] === undefined) {
      return;
    }
    let properties = this.regexMatch[3]
      .split(this.regexMatch[2])
      .map((s: string) => s.trimStart());
    let propIndex: number = this.getPropIndex(properties);
    for (; propIndex < properties.length; propIndex++) {
      const [key, ...parts] = properties[propIndex].split("=");
      const value = parts.length > 0 ? parts.join("=") : undefined;
      if (key === "name") {
        this.name = value;
        continue;
      }
      if (key === "find") {
        this.createNewFind();
        this.currentFind.find = value;
        continue;
      }
      if (key === "flags") {
        this.createNewFindIfNotFound();
        this.currentFind.flags = value;
        continue;
      }
      if (key === "replace") {
        this.createNewFindIfNotFound();
        this.currentFind.replace = value;
        continue;
      }
      this.setProperty(key, value);
    }
  }
  createNewFind() {
    this.currentFind = new FindProperties();
    this.finds.push(this.currentFind);
  }
  createNewFindIfNotFound() {
    if (!this.currentFind) {
      this.createNewFind();
    }
  }
  transform(input: string) {
    let result = input;
    for (const find of this.finds) {
      result = result.replace(new RegExp(find.find, find.flags), find.replace);
    }
    return result;
  }
  getPropIndex(properties: string[]): number {
    throw "Not Implemented";
  }
  setProperty(key: any, value: any) {}
}

class VariableTransformProperties extends VariableProperties {
  constructor(regexMatch: [substring: string, ...args: any[]]) {
    super(regexMatch);
    this.init();
  }
  getPropIndex(properties: string[]): number {
    return 0;
  }
}

function transformVariable(
  data: string,
  variableValue: string,
  variableName: string
) {
  let regex = getVariableWithParamsRegex(variableName, "g");
  return data.replace(regex, (...regexMatch) => {
    let props = new VariableTransformProperties(regexMatch);
    return props.transform(variableValue);
  });
}

async function command(args: any) {
  let command = getProperty(args, "command");
  if (!command) {
    return "Unknown";
  }
  return vscode.commands.executeCommand(command, getProperty(args, "args"));
}
var asyncVariable = async (
  text: string,
  args: any,
  func: {
    (args: any): Promise<unknown>;
    (arg0: any): any;
    (arg0: any): any;
    name?: any;
  }
) => {
  let asyncArgs: any[] = [];
  let varRE = new RegExp(`\\$\\{${func.name}:(.+?)\\}`, "g");
  text = text.replace(varRE, (m: any, p1: string) => {
    let deflt = undefined;
    if (func.name === "command") {
      deflt = { command: p1 };
    }
    let nameArgs = getProperty(getProperty(args, func.name, {}), p1, deflt);
    if (!nameArgs) {
      return "Unknown";
    }
    asyncArgs.push(nameArgs);
    return m;
  });
  for (let i = 0; i < asyncArgs.length; i++) {
    asyncArgs[i] = await func(asyncArgs[i]);
  }
  text = text.replace(varRE, (m: any, p1: any) => {
    return asyncArgs.shift();
  });
  return text;
};
var variableSubstitutionAsync = async (
  text: string,
  args: object,
  document: vscode.TextDocument,
  enableLogging: boolean
) => {
  text = await asyncVariable(text, args, command);
  return text;
};
var variableSubstitution = (
  text: string,
  args: object | null,
  document: vscode.TextDocument,
  enableLogging: boolean
): string | undefined => {
  text = text.replace(/\$\{env:([^}]+)\}/g, (m: any, p1: string) => {
    if (enableLogging) {
      console.log("Use environment variable:", p1);
    }
    return getProperty(process.env, p1, "Unknown");
  });
  text = text.replace(/\$\{workspaceFolder:(.+?)\}/g, (m: any, p1: any) => {
    let wsf = getNamedWorkspaceFolder(p1);
    if (!wsf) {
      return "Unknown";
    }
    return wsf.uri.fsPath;
  });
  let workspace = undefined;
  let documentWorkspace = undefined;
  let file = undefined;
  let fileDirname = undefined;
  let workspaceFolder = undefined;

  if (document) {
    documentWorkspace = vscode.workspace.getWorkspaceFolder(document.uri);
    file = document.fileName;
    fileDirname = path.dirname(file);
    let fileBasename = path.basename(file);
    let fileExtname = path.extname(file);
    let fileBasenameNoExtension = fileBasename.substring(
      0,
      fileBasename.length - fileExtname.length
    );
    text = transformVariable(text, fileDirname, "fileDirname");
    text = transformVariable(text, fileBasename, "fileBasename");
    text = transformVariable(
      text,
      fileBasenameNoExtension,
      "fileBasenameNoExtension"
    );
    text = transformVariable(text, fileExtname, "fileExtname");
  }
  if (text.indexOf("${") >= 0) {
    // workspace related variables
    const wsfolders = dblQuest(vscode.workspace.workspaceFolders, []);
    if (wsfolders.length === 0) {
      vscode.window.showErrorMessage("No Workspace");
      return;
    }
    if (wsfolders.length === 1) {
      workspace = wsfolders[0];
    } else {
      workspace = documentWorkspace;
      if (!workspace) {
        vscode.window.showErrorMessage("Use named Workspace");
        return;
      }
    }
    if (workspace) {
      workspaceFolder = workspace.uri.fsPath;
      let workspaceFolderBasename = path.basename(workspaceFolder);
      text = transformVariable(text, workspaceFolder, "workspaceFolder");
      text = transformVariable(
        text,
        workspaceFolderBasename,
        "workspaceFolderBasename"
      );
    }
    if (documentWorkspace) {
      let relativeFile = file!.substring(workspaceFolder!.length + 1);
      let relativeFileDirname = fileDirname!.substring(
        workspaceFolder!.length + 1
      );
      text = transformVariable(text, workspaceFolder!, "fileWorkspaceFolder");
      text = transformVariable(text, relativeFile, "relativeFile");
      text = transformVariable(
        text,
        relativeFileDirname,
        "relativeFileDirname"
      );
    }
  }
  return text;
};
function findTextDocument(fileURI: vscode.Uri) {
  for (const document of vscode.workspace.textDocuments) {
    if (document.isClosed) {
      continue;
    }
    if (document.uri.scheme != "file") {
      continue;
    }
    if (document.uri.fsPath === fileURI.fsPath) {
      return document;
    }
  }
  return undefined;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context: { subscriptions: vscode.Disposable[] }) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "cf-click" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const testCommand = vscode.commands.registerCommand(
    "cf-click.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from cf-click!");
    }
  );
  context.subscriptions.push(testCommand);

  const relatedLinksProvider = new RelatedLinksProvider();
  vscode.window.registerTreeDataProvider("cf-click", relatedLinksProvider);
  const onChangeActiveTextEditor = async (
    editor: vscode.TextEditor | undefined
  ) => {
    vscode.commands.executeCommand(
      "setContext",
      "cf-click:fileIsHTML",
      editor && editor.document.languageId === "html"
    );
    if (editor) {
      relatedLinksProvider.setPaths(new RelatedPaths(editor.document));
    }
  };
  vscode.window.onDidChangeActiveTextEditor(
    onChangeActiveTextEditor,
    null,
    context.subscriptions
  );
  onChangeActiveTextEditor(vscode.window.activeTextEditor);
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { scheme: "file" },
      {
        provideDocumentLinks: (document) => {
          let relatedPaths = new RelatedPaths(document);
          let editor = vscode.window.activeTextEditor;
          if (editor && editor.document.uri.fsPath === document.uri.fsPath) {
            relatedLinksProvider.setPaths(relatedPaths);
          }
          return relatedPaths.paths
            .filter((p: { docLink: any }) => p.docLink)
            .map((p: any) => new MyDocumentLink(p));
        },
        resolveDocumentLink: async (link: MyDocumentLink, token) => {
          let uri = vscode.Uri.file(link.linkPath);
          if (link.lineSearch) {
            let document = findTextDocument(uri);
            if (document) {
              [link.lineNr, link.charPos] = searchText(
                document,
                link.lineSearch
              );
            } else {
              vscode.window.showInformationMessage(
                `Please keep tab open and try again: ${uri.fsPath}`
              );
            }
          }
          if (link.lineNr) {
            // https://github.com/microsoft/vscode/issues/149523
            let fragment = `L${link.lineNr}`;
            if (link.charPos) {
              fragment += `,${link.charPos}`;
            }
            uri = uri.with({ fragment });
          }
          link.target = uri;
          return link;
        },
      }
    )
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
