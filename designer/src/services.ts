import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	DefaultResourceLoader,
	hasTrustRequiringProjectResources,
	type ModelRuntime,
	type ProjectTrustStore,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentSessionServices } from "@earendil-works/pi-coding-agent";
import type { Diagnostic } from "../shared/protocol.js";

export interface CreateCwdServicesOptions {
	cwd: string;
	agentDir: string;
	modelRuntime: ModelRuntime;
	trustStore: ProjectTrustStore;
}

/**
 * L1: build every cwd-bound service for one working directory.
 *
 * Safe to call repeatedly. It never reuses SettingsManager / ResourceLoader
 * across cwds: both read project-local files and would go stale.
 */
export async function createCwdServices(options: CreateCwdServicesOptions): Promise<AgentSessionServices> {
	const { cwd, agentDir, modelRuntime, trustStore } = options;

	const projectTrusted = !hasTrustRequiringProjectResources(cwd) || trustStore.get(cwd) === true;
	const settingsManager = SettingsManager.create(cwd, agentDir, { projectTrusted });
	const resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });

	await resourceLoader.reload();

	const diagnostics: Diagnostic[] = [];
	const extensions = resourceLoader.getExtensions();

	for (const { name, config, extensionPath } of extensions.runtime.pendingProviderRegistrations) {
		try {
			modelRuntime.registerProvider(name, config);
		} catch (error) {
			diagnostics.push({
				type: "error",
				message: `Extension "${extensionPath}" provider "${name}" failed: ${errorMessage(error)}`,
			});
		}
	}
	extensions.runtime.pendingProviderRegistrations = [];

	for (const { provider, extensionPath } of extensions.runtime.pendingNativeProviderRegistrations) {
		try {
			modelRuntime.registerNativeProvider(provider);
		} catch (error) {
			diagnostics.push({
				type: "error",
				message: `Extension "${extensionPath}" native provider "${provider.id}" failed: ${errorMessage(error)}`,
			});
		}
	}
	extensions.runtime.pendingNativeProviderRegistrations = [];

	for (const { definition, extensionPath } of extensions.runtime.pendingVirtualModelRegistrations) {
		try {
			modelRuntime.registerVirtualModel(definition);
		} catch (error) {
			diagnostics.push({
				type: "error",
				message: `Extension "${extensionPath}" virtual model "${definition.id}" failed: ${errorMessage(error)}`,
			});
		}
	}
	extensions.runtime.pendingVirtualModelRegistrations = [];

	await modelRuntime.refresh({ allowNetwork: false });

	if (!projectTrusted) {
		diagnostics.push({
			type: "info",
			message: `Project resources in ${cwd} are not trusted; using global settings only.`,
		});
	} else if (!existsSync(join(cwd, ".pi"))) {
		diagnostics.push({
			type: "info",
			message: `No .pi configuration in ${cwd}; using global settings.`,
		});
	}

	return {
		cwd,
		agentDir,
		modelRuntime,
		settingsManager,
		resourceLoader,
		diagnostics,
	};
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
