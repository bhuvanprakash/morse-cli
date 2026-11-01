"use strict";
/**
 * Skills Registry
 * Manages registration, enable/disable, and retrieval of skills
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsRegistry = void 0;
exports.createSkillsRegistry = createSkillsRegistry;
const vscode = __importStar(require("vscode"));
/**
 * Skills Registry
 * Central registry for all loaded skills with enable/disable functionality
 */
class SkillsRegistry {
    skills = new Map();
    enabledSkills = new Set();
    categories = new Map();
    loader;
    config;
    eventEmitter = new vscode.EventEmitter();
    stateChangeEmitter = new vscode.EventEmitter();
    constructor(loader, config) {
        this.loader = loader;
        this.config = {
            enabled: config?.enabled ?? true,
            skillsPath: config?.skillsPath ?? '.morse/skills',
            autoLoad: config?.autoLoad ?? true,
            watchForChanges: config?.watchForChanges ?? true,
            cacheEnabled: config?.cacheEnabled ?? true,
            cacheExpirationMinutes: config?.cacheExpirationMinutes ?? 30
        };
        // Initialize category sets
        this.initializeCategories();
        // Listen for skill loaded events
        this.loader.onSkillLoaded((skill) => {
            this.registerSkill(skill);
        });
    }
    /**
     * Initialize empty category sets
     */
    initializeCategories() {
        const categories = [
            'development',
            'security',
            'ai-ml',
            'cloud',
            'frontend',
            'backend',
            'devops',
            'database',
            'mobile',
            'testing',
            'architecture',
            'product',
            'automation',
            'workflow',
            'other'
        ];
        for (const category of categories) {
            this.categories.set(category, new Set());
        }
    }
    /**
     * Event fired when a skill is registered or updated
     */
    get onSkillRegistered() {
        return this.eventEmitter.event;
    }
    /**
     * Event fired when a skill is enabled/disabled
     */
    get onStateChanged() {
        return this.stateChangeEmitter.event;
    }
    /**
     * Register a skill
     */
    registerSkill(skill) {
        // Remove old skill if exists
        if (this.skills.has(skill.id)) {
            const oldSkill = this.skills.get(skill.id);
            // Remove from old category
            const oldCategorySet = this.categories.get(oldSkill.category);
            if (oldCategorySet) {
                oldCategorySet.delete(skill.id);
            }
        }
        // Add to registry
        this.skills.set(skill.id, skill);
        // Add to category
        const categorySet = this.categories.get(skill.category);
        if (categorySet) {
            categorySet.add(skill.id);
        }
        // Enable by default if not already set
        if (!this.enabledSkills.has(skill.id)) {
            this.enabledSkills.add(skill.id);
        }
        this.eventEmitter.fire(skill);
        console.log(`[Skills] Registered skill: ${skill.id} (${skill.category})`);
    }
    /**
     * Unregister a skill
     */
    unregisterSkill(skillId) {
        const skill = this.skills.get(skillId);
        if (!skill) {
            return false;
        }
        // Remove from category
        const categorySet = this.categories.get(skill.category);
        if (categorySet) {
            categorySet.delete(skillId);
        }
        // Remove from enabled set
        this.enabledSkills.delete(skillId);
        // Remove from registry
        this.skills.delete(skillId);
        console.log(`[Skills] Unregistered skill: ${skillId}`);
        return true;
    }
    /**
     * Get a skill by ID
     */
    getSkill(skillId) {
        return this.skills.get(skillId);
    }
    /**
     * Get all registered skills
     */
    getAllSkills() {
        return Array.from(this.skills.values());
    }
    /**
     * Get enabled skills
     */
    getEnabledSkills() {
        return Array.from(this.skills.values()).filter(skill => this.enabledSkills.has(skill.id));
    }
    /**
     * Get skills by category
     */
    getSkillsByCategory(category) {
        const categorySet = this.categories.get(category);
        if (!categorySet) {
            return [];
        }
        return Array.from(categorySet)
            .map(id => this.skills.get(id))
            .filter((skill) => skill !== undefined);
    }
    /**
     * Get all categories with their skills
     */
    getCategories() {
        const result = new Map();
        for (const [category, skillIds] of this.categories) {
            const skills = Array.from(skillIds)
                .map(id => this.skills.get(id))
                .filter((skill) => skill !== undefined);
            if (skills.length > 0) {
                result.set(category, skills);
            }
        }
        return result;
    }
    /**
     * Filter skills based on options
     */
    filterSkills(options) {
        let skills = Array.from(this.skills.values());
        if (options.category) {
            skills = skills.filter(skill => skill.category === options.category);
        }
        if (options.enabled !== undefined) {
            skills = skills.filter(skill => options.enabled ? this.enabledSkills.has(skill.id) : !this.enabledSkills.has(skill.id));
        }
        if (options.searchTerm) {
            const term = options.searchTerm.toLowerCase();
            skills = skills.filter(skill => skill.metadata.name.toLowerCase().includes(term) ||
                skill.metadata.description.toLowerCase().includes(term) ||
                skill.category.toLowerCase().includes(term));
        }
        return skills;
    }
    /**
     * Enable a skill
     */
    enableSkill(skillId) {
        const skill = this.skills.get(skillId);
        if (!skill) {
            return false;
        }
        this.enabledSkills.add(skillId);
        skill.enabled = true;
        this.stateChangeEmitter.fire({ skillId, enabled: true });
        console.log(`[Skills] Enabled skill: ${skillId}`);
        return true;
    }
    /**
     * Disable a skill
     */
    disableSkill(skillId) {
        const skill = this.skills.get(skillId);
        if (!skill) {
            return false;
        }
        this.enabledSkills.delete(skillId);
        skill.enabled = false;
        this.stateChangeEmitter.fire({ skillId, enabled: false });
        console.log(`[Skills] Disabled skill: ${skillId}`);
        return true;
    }
    /**
     * Toggle a skill's enabled state
     */
    toggleSkill(skillId) {
        if (this.enabledSkills.has(skillId)) {
            return this.disableSkill(skillId);
        }
        else {
            return this.enableSkill(skillId);
        }
    }
    /**
     * Check if a skill is enabled
     */
    isSkillEnabled(skillId) {
        return this.enabledSkills.has(skillId);
    }
    /**
     * Get skill count
     */
    getSkillCount() {
        return this.skills.size;
    }
    /**
     * Get enabled skill count
     */
    getEnabledSkillCount() {
        return this.enabledSkills.size;
    }
    /**
     * Load all skills from the loader
     */
    async loadSkills() {
        const skills = await this.loader.loadAllSkills();
        for (const skill of skills) {
            this.registerSkill(skill);
        }
        return skills;
    }
    /**
     * Search skills by query
     */
    searchSkills(query) {
        const term = query.toLowerCase();
        const results = [];
        for (const skill of this.skills.values()) {
            let score = 0;
            // Name match (highest priority)
            if (skill.metadata.name.toLowerCase().includes(term)) {
                score += 10;
            }
            // Description match
            if (skill.metadata.description.toLowerCase().includes(term)) {
                score += 5;
            }
            // Category match
            if (skill.category.toLowerCase().includes(term)) {
                score += 3;
            }
            // Content match
            if (skill.content.toLowerCase().includes(term)) {
                score += 1;
            }
            // Tags match
            if (skill.metadata.tags) {
                for (const tag of skill.metadata.tags) {
                    if (tag.toLowerCase().includes(term)) {
                        score += 7;
                        break;
                    }
                }
            }
            if (score > 0) {
                results.push({ skill, score });
            }
        }
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        return results.map(r => r.skill);
    }
    /**
     * Resolve skill dependencies
     */
    resolveDependencies(skillId) {
        const skill = this.skills.get(skillId);
        if (!skill || !skill.metadata.dependencies) {
            return [];
        }
        const resolved = [];
        const visited = new Set();
        const resolve = (depId) => {
            if (visited.has(depId)) {
                return;
            }
            visited.add(depId);
            const depSkill = this.skills.get(depId);
            if (depSkill) {
                resolved.push(depSkill);
                // Recursively resolve dependencies
                if (depSkill.metadata.dependencies) {
                    for (const subDep of depSkill.metadata.dependencies) {
                        resolve(subDep);
                    }
                }
            }
        };
        for (const dep of skill.metadata.dependencies) {
            resolve(dep);
        }
        return resolved;
    }
    /**
     * Get skill by name (case-insensitive)
     */
    getSkillByName(name) {
        const lowerName = name.toLowerCase();
        for (const skill of this.skills.values()) {
            if (skill.metadata.name.toLowerCase() === lowerName) {
                return skill;
            }
        }
        return undefined;
    }
    /**
     * Get the loader instance
     */
    getLoader() {
        return this.loader;
    }
    /**
     * Clear all skills
     */
    clear() {
        this.skills.clear();
        this.enabledSkills.clear();
        this.initializeCategories();
        console.log('[Skills] Registry cleared');
    }
    /**
     * Dispose the registry
     */
    dispose() {
        this.eventEmitter.dispose();
        this.stateChangeEmitter.dispose();
    }
}
exports.SkillsRegistry = SkillsRegistry;
/**
 * Create a skills registry
 */
function createSkillsRegistry(loader, config) {
    return new SkillsRegistry(loader, config);
}
//# sourceMappingURL=registry.js.map