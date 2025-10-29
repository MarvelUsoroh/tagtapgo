/**
 * Adapter Factory and Registry
 * 
 * Creates and manages SIS/LMS adapters for multiple universities.
 * Supports Moodle, openSIS, and Generic REST adapters with health monitoring.
 * 
 * Reference: .kiro/specs/gamification-mvp/OpenAPI.md
 */

import type {
  IAdapter,
  AnyAdapterConfig,
  MoodleConfig,
  OpenSISConfig,
  GenericConfig,
} from './adapter-interface.ts';
import { MoodleAdapter } from './moodle-adapter.ts';
import { OpenSISAdapter } from './opensis-adapter.ts';
import { GenericAdapter } from './generic-adapter.ts';

// ============================================================================
// Factory
// ============================================================================

/**
 * Adapter Factory
 * Creates adapter instances based on configuration
 */
export class AdapterFactory {
  /**
   * Create an adapter instance based on configuration
   */
  static create(config: AnyAdapterConfig): IAdapter {
    switch (config.type) {
      case 'moodle':
        return new MoodleAdapter(config as MoodleConfig);
      
      case 'opensis':
        return new OpenSISAdapter(config as OpenSISConfig);
      
      case 'generic':
        return new GenericAdapter(config as GenericConfig);
      
      default:
        throw new Error(`Unknown adapter type: ${(config as any).type}`);
    }
  }

  /**
   * Create and initialize an adapter (runs discovery)
   */
  static async createAndDiscover(config: AnyAdapterConfig): Promise<IAdapter> {
    const adapter = this.create(config);
    await adapter.discover();
    return adapter;
  }
}

// ============================================================================
// Registry
// ============================================================================

/**
 * Health status for an adapter
 */
export interface AdapterHealth {
  universityId: string;
  type: string;
  healthy: boolean;
  lastCheck: Date;
  lastSuccess?: Date;
  lastError?: string;
  consecutiveFailures: number;
}

/**
 * Adapter Registry
 * Manages multiple adapters with health monitoring
 */
export class AdapterRegistry {
  private adapters: Map<string, IAdapter> = new Map();
  private health: Map<string, AdapterHealth> = new Map();
  private configs: Map<string, AnyAdapterConfig> = new Map();

  /**
   * Register an adapter for a university
   */
  async register(universityId: string, config: AnyAdapterConfig): Promise<void> {
    console.log(`[AdapterRegistry] Registering adapter for university ${universityId} (type: ${config.type})`);
    
    try {
      // Create and discover adapter
      const adapter = await AdapterFactory.createAndDiscover(config);
      
      // Store adapter and config
      this.adapters.set(universityId, adapter);
      this.configs.set(universityId, config);
      
      // Initialize health status
      this.health.set(universityId, {
        universityId,
        type: config.type,
        healthy: true,
        lastCheck: new Date(),
        lastSuccess: new Date(),
        consecutiveFailures: 0,
      });
      
      console.log(`[AdapterRegistry] Successfully registered adapter for university ${universityId}`);
    } catch (error) {
      console.error(`[AdapterRegistry] Failed to register adapter for university ${universityId}:`, error);
      
      // Store failed health status
      this.health.set(universityId, {
        universityId,
        type: config.type,
        healthy: false,
        lastCheck: new Date(),
        lastError: error.message,
        consecutiveFailures: 1,
      });
      
      throw error;
    }
  }

  /**
   * Unregister an adapter
   */
  unregister(universityId: string): void {
    console.log(`[AdapterRegistry] Unregistering adapter for university ${universityId}`);
    this.adapters.delete(universityId);
    this.health.delete(universityId);
    this.configs.delete(universityId);
  }

  /**
   * Get an adapter for a university
   */
  get(universityId: string): IAdapter | undefined {
    return this.adapters.get(universityId);
  }

  /**
   * Get all registered university IDs
   */
  getUniversityIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get health status for a university
   */
  getHealth(universityId: string): AdapterHealth | undefined {
    return this.health.get(universityId);
  }

  /**
   * Get health status for all universities
   */
  getAllHealth(): AdapterHealth[] {
    return Array.from(this.health.values());
  }

  /**
   * Check health of a specific adapter
   */
  async checkHealth(universityId: string): Promise<boolean> {
    const adapter = this.adapters.get(universityId);
    const health = this.health.get(universityId);
    
    if (!adapter || !health) {
      console.warn(`[AdapterRegistry] No adapter found for university ${universityId}`);
      return false;
    }

    console.log(`[AdapterRegistry] Checking health for university ${universityId}...`);
    
    try {
      const isHealthy = await adapter.healthCheck();
      
      // Update health status
      health.lastCheck = new Date();
      health.healthy = isHealthy;
      
      if (isHealthy) {
        health.lastSuccess = new Date();
        health.consecutiveFailures = 0;
        health.lastError = undefined;
      } else {
        health.consecutiveFailures++;
      }
      
      this.health.set(universityId, health);
      
      console.log(`[AdapterRegistry] Health check for university ${universityId}: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      
      return isHealthy;
    } catch (error) {
      console.error(`[AdapterRegistry] Health check failed for university ${universityId}:`, error);
      
      // Update health status
      health.lastCheck = new Date();
      health.healthy = false;
      health.lastError = error.message;
      health.consecutiveFailures++;
      
      this.health.set(universityId, health);
      
      return false;
    }
  }

  /**
   * Check health of all adapters
   */
  async checkAllHealth(): Promise<Map<string, boolean>> {
    console.log(`[AdapterRegistry] Checking health for all ${this.adapters.size} adapters...`);
    
    const results = new Map<string, boolean>();
    
    for (const universityId of this.adapters.keys()) {
      const isHealthy = await this.checkHealth(universityId);
      results.set(universityId, isHealthy);
    }
    
    const healthyCount = Array.from(results.values()).filter(h => h).length;
    console.log(`[AdapterRegistry] Health check complete: ${healthyCount}/${results.size} adapters healthy`);
    
    return results;
  }

  /**
   * Get unhealthy adapters (for alerting)
   */
  getUnhealthyAdapters(minConsecutiveFailures = 3): AdapterHealth[] {
    return Array.from(this.health.values()).filter(
      h => !h.healthy && h.consecutiveFailures >= minConsecutiveFailures
    );
  }

  /**
   * Attempt to recover a failed adapter
   */
  async recover(universityId: string): Promise<boolean> {
    console.log(`[AdapterRegistry] Attempting to recover adapter for university ${universityId}...`);
    
    const config = this.configs.get(universityId);
    if (!config) {
      console.error(`[AdapterRegistry] No config found for university ${universityId}`);
      return false;
    }

    try {
      // Unregister old adapter
      this.unregister(universityId);
      
      // Re-register with same config
      await this.register(universityId, config);
      
      console.log(`[AdapterRegistry] Successfully recovered adapter for university ${universityId}`);
      return true;
    } catch (error) {
      console.error(`[AdapterRegistry] Failed to recover adapter for university ${universityId}:`, error);
      return false;
    }
  }

  /**
   * Get adapter statistics
   */
  getStats(): {
    total: number;
    healthy: number;
    unhealthy: number;
    byType: Record<string, number>;
  } {
    const healthArray = Array.from(this.health.values());
    
    const byType: Record<string, number> = {};
    for (const h of healthArray) {
      byType[h.type] = (byType[h.type] || 0) + 1;
    }
    
    return {
      total: healthArray.length,
      healthy: healthArray.filter(h => h.healthy).length,
      unhealthy: healthArray.filter(h => !h.healthy).length,
      byType,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global adapter registry instance
 * Use this for application-wide adapter management
 */
export const globalAdapterRegistry = new AdapterRegistry();
