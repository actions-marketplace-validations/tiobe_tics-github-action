import { baseUrl, ticsConfig } from '../github/configuration';
import Logger from '../helper/logger';
import { getItemFromUrl, getProjectName, httpRequest } from './api_helper';

/**
 * Retrieves the files TiCS analyzed from the TiCS viewer.
 * @param url The TiCS explorer url.
 * @returns the analyzed files.
 */
export async function getAnalyzedFiles(url: string): Promise<any> {
  Logger.Instance.header('Retrieving analyzed files.');
  const analyzedFilesUrl = getAnalyzedFilesUrl(url);
  Logger.Instance.debug(`From: ${analyzedFilesUrl}`);

  try {
    const response = await httpRequest(analyzedFilesUrl);
    Logger.Instance.debug(response);
    Logger.Instance.info('Retrieved the analyzed files.');
    return response;
  } catch (error: any) {
    Logger.Instance.exit(`There was an error retrieving the analyzed files: ${error.message}`);
  }
}

function getAnalyzedFilesUrl(url: string) {
  let getAnalyzedFilesUrl = new URL(baseUrl + '/api/public/v1/Measure?metrics=filePath');

  const clientData = getItemFromUrl(url, 'ClientData');
  const projectName = getProjectName(url);
  getAnalyzedFilesUrl.searchParams.append('filters', `ClientData(${clientData}),Project(${projectName}),Window(-1),File()`);

  return getAnalyzedFilesUrl.href;
}

/**
 * Retrieves the TiCS quality gate from the TiCS viewer.
 * @param url The TiCS explorer url.
 * @returns the quality gates
 */
export async function getQualityGate(url: string): Promise<any> {
  Logger.Instance.header('Retrieving the quality gates.');
  const qualityGateUrl = getQualityGateUrl(url);
  Logger.Instance.debug(`From: ${qualityGateUrl}`);

  try {
    const response = await httpRequest(qualityGateUrl);
    Logger.Instance.info('Retrieved the quality gates.');
    return response;
  } catch (error: any) {
    Logger.Instance.exit(`There was an error retrieving the quality gates: ${error.message}`);
  }
}

/**
 * Builds the quality gate url from the explorer url.
 * @param url The TiCS Explorer url.
 * @returns The url to get the quality gate analysis.
 */
function getQualityGateUrl(url: string) {
  let qualityGateUrl = new URL(baseUrl + '/api/public/v1/QualityGateStatus');

  const projectName = getProjectName(url);
  qualityGateUrl.searchParams.append('project', projectName);

  // Branchname is optional, to check if it is set
  if (ticsConfig.branchName) {
    qualityGateUrl.searchParams.append('branch', ticsConfig.branchName);
  }

  qualityGateUrl.searchParams.append('fields', 'details,annotationsApiV1Links');

  const clientData = getItemFromUrl(url, 'ClientData');
  qualityGateUrl.searchParams.append('cdt', clientData);

  return qualityGateUrl.href;
}

/**
 * Gets the annotations from the TiCS viewer.
 * @param apiLinks annotationsApiLinks url.
 * @returns TiCS annotations.
 */
export async function getAnnotations(apiLinks: any[]) {
  Logger.Instance.header('Retrieving annotations.');
  try {
    let annotations: any[] = [];
    await Promise.all(
      apiLinks.map(async link => {
        const annotationsUrl = `${baseUrl}/${link.url}`;
        Logger.Instance.debug(`From: ${annotationsUrl}`);
        const response = await httpRequest(annotationsUrl);
        response.data.forEach((annotation: any) => {
          annotations.push(annotation);
        });
      })
    );
    Logger.Instance.info('Retrieved all annotations.');
    return annotations;
  } catch (error: any) {
    Logger.Instance.exit(`An error occured when trying to retrieve annotations: ${error.message}`);
  }
}
