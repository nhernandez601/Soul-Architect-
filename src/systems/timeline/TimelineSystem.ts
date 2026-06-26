/**
 * TimelineSystem — tracks story branching history for the timeline viewer.
 *
 * Records every scene visited, choice made, and branch taken.
 * Powers the in-game timeline screen showing how the story unfolded
 * across the current playthrough (and across multiple playthroughs).
 */

import { BaseService } from '../../engine/core/BaseService';
import type { ID, Timestamp } from '@t/core';

export interface TimelineNode {
  id: ID;
  sceneId: ID;
  sceneTitle: string;
  chapter: number;
  act: number;
  visitedAt: Timestamp;
  choiceMade?: string;     // text of choice that led here
  choiceIndex?: number;
  branchLabel?: string;    // human-readable branch name
  isEnding: boolean;
  soulSnapshot?: Record<string, number>; // soul values at this point
}

export interface TimelineBranch {
  id: ID;
  nodes: TimelineNode[];
  startedAt: Timestamp;
  endedAt?: Timestamp;
  endingId?: ID;
  playthroughNumber: number;
}

export class TimelineSystem extends BaseService {
  private currentBranch: TimelineBranch;
  private readonly allBranches: TimelineBranch[] = [];
  private playthroughNumber = 1;
  private nodeCounter = 0;

  constructor() {
    super('TimelineSystem');
    this.currentBranch = this.createBranch();
  }

  protected async onInit(): Promise<void> {
    this.subscribe('scene:load_complete', ({ sceneId }) => {
      this.recordSceneVisit(sceneId);
    });

    this.subscribe('choice:selected', ({ choiceId, choiceIndex }) => {
      const last = this.getLastNode();
      if (last) {
        last.choiceMade = choiceId;
        last.choiceIndex = choiceIndex;
      }
    });

    this.subscribe('soul:state_snapshot', ({ state }) => {
      const last = this.getLastNode();
      if (last) {
        last.soulSnapshot = { ...state.stats } as Record<string, number>;
      }
    });
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void { this.allBranches.length = 0; }

  // ---------------------------------------------------------------------------
  // Recording
  // ---------------------------------------------------------------------------

  private recordSceneVisit(sceneId: ID): void {
    // Soul snapshot injected by the soul event above
    const node: TimelineNode = {
      id: `tl_${this.nodeCounter++}`,
      sceneId,
      sceneTitle: sceneId.replace(/_/g, ' '), // fallback; SceneManager can update this
      chapter: 1,
      act: 1,
      visitedAt: Date.now(),
      isEnding: sceneId.includes('ending'),
    };
    this.currentBranch.nodes.push(node);
  }

  updateLastNodeTitle(title: string, chapter: number, act: number): void {
    const last = this.getLastNode();
    if (last) { last.sceneTitle = title; last.chapter = chapter; last.act = act; }
  }

  recordEnding(endingId: ID): void {
    const last = this.getLastNode();
    if (last) last.isEnding = true;
    this.currentBranch.endingId = endingId;
    this.currentBranch.endedAt = Date.now();
    this.archiveBranch();
  }

  startNewPlaythrough(): void {
    this.playthroughNumber++;
    this.currentBranch = this.createBranch();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private createBranch(): TimelineBranch {
    const branch: TimelineBranch = {
      id: `branch_${this.playthroughNumber}`,
      nodes: [],
      startedAt: Date.now(),
      playthroughNumber: this.playthroughNumber,
    };
    this.allBranches.push(branch);
    return branch;
  }

  private archiveBranch(): void {
    // Branch is already in allBranches; create a new one for next playthrough
    this.currentBranch = this.createBranch();
  }

  private getLastNode(): TimelineNode | undefined {
    return this.currentBranch.nodes[this.currentBranch.nodes.length - 1];
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  getCurrentBranch(): TimelineBranch { return this.currentBranch; }

  getAllBranches(): TimelineBranch[] { return [...this.allBranches]; }

  getCompletedBranches(): TimelineBranch[] {
    return this.allBranches.filter((b) => !!b.endedAt);
  }

  getNodeCount(): number { return this.currentBranch.nodes.length; }

  getVisitedSceneIds(): Set<ID> {
    return new Set(this.currentBranch.nodes.map((n) => n.sceneId));
  }
}
