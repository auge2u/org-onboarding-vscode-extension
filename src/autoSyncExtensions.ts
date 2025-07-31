import * as vscode from "vscode";

export interface ExtensionRecommendation {
  id: string;
  name: string;
  publisher: string;
  description?: string;
  required?: boolean;
}

export const DEFAULT_ORG_EXTENSIONS: ExtensionRecommendation[] = [
  {
    id: "dbaeumer.vscode-eslint",
    name: "ESLint",
    publisher: "Microsoft",
    description: "JavaScript and TypeScript linting",
    required: true
  },
  {
    id: "esbenp.prettier-vscode",
    name: "Prettier",
    publisher: "Prettier",
    description: "Code formatter",
    required: true
  },
  {
    id: "SonarSource.sonarlint-vscode",
    name: "SonarLint",
    publisher: "SonarSource",
    description: "Code quality and security analysis",
    required: true
  },
  {
    id: "davidanson.vscode-markdownlint",
    name: "markdownlint",
    publisher: "David Anson",
    description: "Markdown linting and style checking",
    required: false
  },
  {
    id: "streetsidesoftware.code-spell-checker",
    name: "Code Spell Checker",
    publisher: "Street Side Software",
    description: "Spelling checker for source code",
    required: false
  },
  {
    id: "wix.vscode-import-cost",
    name: "Import Cost",
    publisher: "Wix",
    description: "Display import/require package size",
    required: false
  },
  {
    id: "bradlc.vscode-tailwindcss",
    name: "Tailwind CSS IntelliSense",
    publisher: "Tailwind Labs",
    description: "Tailwind CSS class name completion",
    required: false
  },
  {
    id: "ms-vscode.vscode-typescript-next",
    name: "TypeScript Importer",
    publisher: "Microsoft",
    description: "Automatically searches for TypeScript definitions",
    required: false
  }
];

export async function autoSyncExtensions(recommended?: ExtensionRecommendation[]): Promise<string[]> {
  const extensionsToCheck = recommended || DEFAULT_ORG_EXTENSIONS;
  const installed = vscode.extensions.all.map((ext: vscode.Extension<any>) => ext.id);
  const missing = extensionsToCheck.filter(rec => !installed.includes(rec.id));
  
  if (missing.length === 0) {
    vscode.window.showInformationMessage("✅ All recommended extensions are already installed!");
    return [];
  }

  const requiredMissing = missing.filter(ext => ext.required);
  const optionalMissing = missing.filter(ext => !ext.required);

  let message = `Found ${missing.length} missing extensions:\n`;
  
  if (requiredMissing.length > 0) {
    message += `\n🔴 Required (${requiredMissing.length}):\n`;
    requiredMissing.forEach(ext => {
      message += `  • ${ext.name} (${ext.id})\n`;
    });
  }

  if (optionalMissing.length > 0) {
    message += `\n🟡 Recommended (${optionalMissing.length}):\n`;
    optionalMissing.forEach(ext => {
      message += `  • ${ext.name} (${ext.id})\n`;
    });
  }

  const actions: string[] = [];
  if (requiredMissing.length > 0) {
    actions.push("Install Required");
  }
  if (optionalMissing.length > 0) {
    actions.push("Install All");
  }
  actions.push("View Details", "Skip");

  const choice = await vscode.window.showWarningMessage(
    message,
    ...actions
  );

  switch (choice) {
    case "Install Required":
      await installExtensions(requiredMissing);
      break;
    case "Install All":
      await installExtensions(missing);
      break;
    case "View Details":
      await showExtensionDetails(missing);
      break;
    default:
      // Skip - do nothing
      break;
  }

  return missing.map(ext => ext.id);
}

export function checkMissingExtensionsSilent(recommended?: ExtensionRecommendation[]): string[] {
  const extensionsToCheck = recommended || DEFAULT_ORG_EXTENSIONS;
  const installed = vscode.extensions.all.map((ext: vscode.Extension<any>) => ext.id);
  const missing = extensionsToCheck.filter(rec => !installed.includes(rec.id));
  
  return missing.map(ext => ext.id);
}

async function installExtensions(extensions: ExtensionRecommendation[]): Promise<void> {
  for (const ext of extensions) {
    try {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', ext.id);
      vscode.window.showInformationMessage(`✅ Installed: ${ext.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Failed to install ${ext.name}: ${error}`);
    }
  }
  
  if (extensions.length > 0) {
    vscode.window.showInformationMessage(
      `🔄 Installed ${extensions.length} extensions. Please reload VSCode to activate them.`,
      "Reload Window"
    ).then((choice: string | undefined) => {
      if (choice === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
  }
}

async function showExtensionDetails(extensions: ExtensionRecommendation[]): Promise<void> {
  const quickPickItems = extensions.map(ext => ({
    label: ext.name,
    description: ext.id,
    detail: ext.description,
    extension: ext
  }));

  const selected = await vscode.window.showQuickPick(quickPickItems, {
    canPickMany: true,
    placeHolder: "Select extensions to install"
  });

  if (selected && selected.length > 0) {
    await installExtensions(selected.map((item: any) => item.extension));
  }
}

export async function checkExtensionHealth(): Promise<{healthy: number, issues: string[]}> {
  const issues: string[] = [];
  let healthy = 0;

  // Check if ESLint is working
  const eslintExt = vscode.extensions.getExtension('dbaeumer.vscode-eslint');
  if (eslintExt) {
    if (eslintExt.isActive) {
      healthy++;
    } else {
      issues.push("ESLint extension is installed but not active");
    }
  } else {
    issues.push("ESLint extension is not installed");
  }

  // Check if Prettier is working
  const prettierExt = vscode.extensions.getExtension('esbenp.prettier-vscode');
  if (prettierExt) {
    if (prettierExt.isActive) {
      healthy++;
    } else {
      issues.push("Prettier extension is installed but not active");
    }
  } else {
    issues.push("Prettier extension is not installed");
  }

  // Check workspace settings for format on save
  const config = vscode.workspace.getConfiguration();
  const formatOnSave = config.get('editor.formatOnSave');
  if (formatOnSave) {
    healthy++;
  } else {
    issues.push("Format on save is not enabled");
  }

  return { healthy, issues };
}

export async function generateWorkspaceExtensionsJson(extensions: ExtensionRecommendation[]): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No workspace folder found");
    return;
  }

  const extensionsConfig = {
    recommendations: extensions.map(ext => ext.id),
    unwantedRecommendations: []
  };

  const vscodeFolderUri = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode');
  const extensionsFileUri = vscode.Uri.joinPath(vscodeFolderUri, 'extensions.json');

  try {
    await vscode.workspace.fs.createDirectory(vscodeFolderUri);
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(
      extensionsFileUri,
      encoder.encode(JSON.stringify(extensionsConfig, null, 2))
    );
    
    vscode.window.showInformationMessage(
      "✅ Created .vscode/extensions.json with org recommendations",
      "Open File"
    ).then((choice: string | undefined) => {
      if (choice === "Open File") {
        vscode.window.showTextDocument(extensionsFileUri);
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create extensions.json: ${error}`);
  }
}