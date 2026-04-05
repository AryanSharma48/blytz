export function detectProjectType(context) {
    if (context?.hasPackageJson) return "node";
    if (context?.hasRequirementsTxt) return "python";
    return "unknown";
}