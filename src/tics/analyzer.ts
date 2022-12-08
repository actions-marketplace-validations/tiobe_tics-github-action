import { exec } from '@actions/exec';
import { baseUrl, githubConfig, ticsConfig, viewerUrl } from '../github/configuration';
import Logger from '../helper/logger';
import { getInstallTiCSApiUrl, httpRequest } from './api_helper';

let errorList: string[] = [];
let warningList: string[] = [];
let filesAnalyzed: string[] = [];
let explorerUrl: string | undefined;

/**
 * Runs TiCS based on the configuration set in a workflow.
 * @param fileListPath Path to changedFiles.txt.
 */
export async function runTiCSAnalyzer(fileListPath: string) {
  Logger.Instance.header(`Analyzing new pull request for project ${ticsConfig.projectName}`);

  const command = await buildRunCommand(fileListPath);

  Logger.Instance.header('Running TiCS');
  try {
    const statusCode = await exec(command, [], {
      silent: true,
      listeners: {
        stdout(data: Buffer) {
          Logger.Instance.info(data.toString());
          findInStdOutOrErr(data.toString(), fileListPath);
        },
        stderr(data: Buffer) {
          Logger.Instance.info(data.toString());
          findInStdOutOrErr(data.toString(), fileListPath);
        }
      }
    });

    return {
      statusCode: statusCode,
      explorerUrl: explorerUrl,
      filesAnalyzed: filesAnalyzed,
      errorList: errorList,
      warningList: warningList
    };
  } catch (error: any) {
    return {
      statusCode: -1,
      errorList: errorList,
      warningList: warningList
    };
  }
}

/**
 * Build the command to run (and optionally install) TiCS.
 * @param fileListPath Path to changedFiles.txt.
 * @returns Command to run.
 */
async function buildRunCommand(fileListPath: string) {
  if (githubConfig.runnerOS === 'Linux') {
    return `/bin/bash -c "${await getInstallTiCS()} ${getTiCSCommand(fileListPath)}"`;
  }
  return `powershell "${await getInstallTiCS()} ${getTiCSCommand(fileListPath)}"`;
}

/**
 * Get the command to install TiCS with.
 */
async function getInstallTiCS() {
  if (!ticsConfig.installTics) return '';

  const installTicsUrl = await retrieveInstallTics(githubConfig.runnerOS.toLowerCase());

  if (githubConfig.runnerOS === 'Linux') {
    return `source <(curl -s '${installTicsUrl}') &&`;
  }
  return `Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('${installTicsUrl}')) &&`;
}

/**
 * Push warnings or errors to a list to summarize them on exit.
 * @param data stdout or stderr
 */
function findInStdOutOrErr(data: string, fileListPath: string) {
  const error = data.toString().match(/\[ERROR.*/g);
  if (error && !errorList.find(e => e === error?.toString())) errorList.push(error.toString());

  const warning = data.toString().match(/\[WARNING.*/g);
  if (warning && !warningList.find(w => w === warning?.toString())) warningList.push(warning.toString());

  const fileAnalyzed = data.match(/\[INFO 30\d{2}\] Analyzing.*/g)?.toString();
  if (fileAnalyzed) {
    const file = fileAnalyzed.split(fileListPath.replace('changedFiles.txt', ''))[1];
    if (!filesAnalyzed.find(f => f === file)) filesAnalyzed.push(file);
  }

  const findExplorerUrl = data.match(/\/Explorer.*/g);
  if (!explorerUrl && findExplorerUrl) explorerUrl = viewerUrl + findExplorerUrl.slice(-1).pop();
}

/**
 * Retrieves the the TiCS install url from the ticsConfiguration.
 * @param os the OS the runner runs on.
 * @returns the TiCS install url.
 */
async function retrieveInstallTics(os: string) {
  try {
    Logger.Instance.info('Trying to retrieve configuration information from TiCS.');

    const ticsInstallApiBaseUrl = getInstallTiCSApiUrl(baseUrl, os);

    const data = await httpRequest(ticsInstallApiBaseUrl);

    return baseUrl + data.links.installTics;
  } catch (error: any) {
    Logger.Instance.exit(`An error occurred when trying to retrieve configuration information: ${error.message}`);
  }
}

/**
 * Builds the TiCS calculate command based on the fileListPath and the ticsConfig set.
 * @param fileListPath
 * @returns string of the command to run TiCS.
 */
function getTiCSCommand(fileListPath: string) {
  let execString = 'TICS @' + fileListPath + ' ';
  execString += ticsConfig.calc.includes('GATE') ? '' : '-viewer ';
  execString += ticsConfig.calc ? `-calc ${ticsConfig.calc} ` : '-recalc GATE ';
  execString += ticsConfig.projectName ? `-project ${ticsConfig.projectName} ` : '';
  execString += ticsConfig.clientToken ? `-cdtoken ${ticsConfig.clientToken} ` : '';
  execString += ticsConfig.tmpDir ? `-tmpdir ${ticsConfig.tmpDir} ` : '';
  execString += ticsConfig.extendTics ? ticsConfig.extendTics : '';
  return execString;
}
