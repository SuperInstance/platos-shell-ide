/**
 * Room Inspector — Tree View Provider
 * ===================================
 *
 * A custom tree view in the activity bar sidebar that shows the game world
 * hierarchy:
 *
 * 🏠 Bar-Rail (current room)
 *   📦 Objects
 *     🎵 Jukebox [playing]
 *       Verbs: USE, LOOK AT
 *     🚪 Door (Aft Deck) [closed]
 *       Verbs: OPEN, CLOSE, LOOK AT
 *     🪑 Bar Stool
 *       Verbs: LOOK AT, SIT
 *   🤖 Agents
 *     👤 Riker [idle]
 *       Verbs: TALK TO, ASK ABOUT, GIVE
 *   📜 Exits
 *     → aft-deck
 *     → radio-room
 *
 * Nodes are clickable:
 * - Clicking a verb node sends the verb to the MUD terminal
 * - Clicking an object opens its source file in the editor
 * - Clicking an exit navigates to that room (sends "go <direction>" to MUD)
 *
 * Data Sources (Phase 1 → Phase 2):
 * - Phase 1: reads from workspace files (rooms/*.json or rooms/*.ts exports)
 * - Phase 2: connects to SharedWorldStore via WebSocket for live state
 * - Phase 3: A2UI enhances with "most likely" verb highlighting
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EventLogger } from './a2ui/event-logger';

type TreeNodeType = 'room' | 'category' | 'object' | 'agent' | 'verb' | 'exit';

export interface PlatoTreeNode {
    type: TreeNodeType;
    label: string;
    description?: string;
    tooltip?: string;
    contextValue?: string;
    children?: PlatoTreeNode[];
    // Metadata for actions
    verbCommand?: string;     // For verb nodes: the command to send to MUD
    filePath?: string;        // For object/agent nodes: source file path
    roomId?: string;          // For exit nodes: destination room ID
}

export class RoomInspectorProvider implements vscode.TreeDataProvider<PlatoTreeNode> {

    private _onDidChange = new vscode.EventEmitter<PlatoTreeNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    private currentRoom: PlatoTreeNode | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly eventLogger?: EventLogger
    ) {}

    register(): void {
        // Register the tree data provider
        vscode.window.registerTreeDataProvider('plato.roomInspector', this);

        // Register the object/agent tree
        vscode.window.registerTreeDataProvider('plato.objectTree', new ObjectTreeProvider(this));

        // Refresh command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('plato.refreshInspector', () => {
                this.refresh();
            })
        );

        // Click handler for tree nodes
        this.context.subscriptions.push(
            vscode.commands.registerCommand('plato.nodeClicked', (node: PlatoTreeNode) => {
                this.handleNodeClick(node);
            })
        );
    }

    refresh(): void {
        this._onDidChange.fire(undefined);
    }

    getTreeItem(element: PlatoTreeNode): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, this.getCollapsibleState(element));
        item.description = element.description;
        item.tooltip = element.tooltip || element.label;
        item.contextValue = element.contextValue || element.type;

        // Set icon based on type
        item.iconPath = this.getIcon(element);

        // For verb/exit nodes, make them clickable (command)
        if (element.type === 'verb' || element.type === 'exit') {
            item.command = {
                command: 'plato.nodeClicked',
                title: 'Activate',
                arguments: [element]
            };
        }

        return item;
    }

    getChildren(element?: PlatoTreeNode): PlatoTreeNode[] {
        if (!element) {
            // Root level — return the room structure
            return this.getRoomStructure();
        }
        return element.children || [];
    }

    /**
     * Build the room tree structure.
     *
     * Phase 1: reads from workspace files.
     * Looks for rooms/ directory in the workspace and parses room definitions.
     */
    private getRoomStructure(): PlatoTreeNode[] {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return [{
                type: 'room',
                label: 'No workspace open',
                description: 'Open the platos-shell workspace',
                tooltip: 'Open the platos-shell project folder to see the world tree'
            }];
        }

        const roomsDir = path.join(workspaceRoot, 'rooms');
        if (!fs.existsSync(roomsDir)) {
            return [{
                type: 'room',
                label: 'No rooms/ directory found',
                description: 'Expected at: ' + roomsDir,
                tooltip: 'Create a rooms/ directory with room definitions'
            }];
        }

        // Discover rooms from filesystem
        const rooms = this.discoverRooms(roomsDir);
        if (rooms.length === 0) {
            return [{
                type: 'room',
                label: 'No rooms defined yet',
                description: 'Add room directories under rooms/'
            }];
        }

        // For Phase 1, show the first room as "current"
        // In Phase 2, this comes from SharedWorldStore live state
        return rooms;
    }

    /**
     * Discover room definitions from the filesystem.
     *
     * Expected structure:
     *   rooms/
     *     bar-rail/
     *       room.json (or room.ts exporting room config)
     *       hotspots.json
     *     galley/
     *       room.json
     *     wheel-house/
     *       room.json
     */
    private discoverRooms(roomsDir: string): PlatoTreeNode[] {
        const rooms: PlatoTreeNode[] = [];

        try {
            const entries = fs.readdirSync(roomsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const roomDir = path.join(roomsDir, entry.name);
                const roomDef = this.loadRoomDefinition(roomDir, entry.name);
                rooms.push(roomDef);
            }
        } catch (err) {
            console.error('[Plato\'s Shell] Error discovering rooms:', err);
        }

        return rooms;
    }

    /**
     * Load a room definition from its directory.
     */
    private loadRoomDefinition(roomDir: string, roomName: string): PlatoTreeNode {
        const roomLabel = this.titleCase(roomName.replace(/-/g, ' '));

        // Try to load room.json
        const roomJsonPath = path.join(roomDir, 'room.json');
        let roomData: any = {};
        if (fs.existsSync(roomJsonPath)) {
            try {
                roomData = JSON.parse(fs.readFileSync(roomJsonPath, 'utf-8'));
            } catch (err) {
                console.error(`[Plato\'s Shell] Error parsing ${roomJsonPath}:`, err);
            }
        }

        // Build object children
        const objects: PlatoTreeNode[] = (roomData.hotspots || []).map((h: any) => ({
            type: 'object' as TreeNodeType,
            label: h.name || 'Unnamed',
            description: h.state ? `[${h.state}]` : undefined,
            tooltip: h.description || h.name,
            filePath: roomJsonPath,
            children: (h.verbs || ['LOOK AT', 'USE']).map((v: string) => ({
                type: 'verb' as TreeNodeType,
                label: v,
                description: '',
                tooltip: `${v} ${h.name || ''}`,
                verbCommand: `${v.toLowerCase()} ${h.name || ''}`.toLowerCase(),
            }))
        }));

        // Build agent children
        const agents: PlatoTreeNode[] = (roomData.agents || []).map((a: any) => ({
            type: 'agent' as TreeNodeType,
            label: a.name || 'Unknown Agent',
            description: a.state ? `[${a.state}]` : undefined,
            tooltip: a.description || a.name,
            filePath: a.dialogueFile ? path.join(roomDir, a.dialogueFile) : undefined,
            children: ['TALK TO', 'ASK ABOUT', 'GIVE'].map((v: string) => ({
                type: 'verb' as TreeNodeType,
                label: v,
                description: '',
                tooltip: `${v} ${a.name || ''}`,
                verbCommand: `${v.toLowerCase()} ${a.name || ''}`.toLowerCase(),
            }))
        }));

        // Build exit children
        const exits: PlatoTreeNode[] = (roomData.exits || []).map((e: any) => ({
            type: 'exit' as TreeNodeType,
            label: `→ ${e.name || e.target}`,
            description: e.direction,
            tooltip: `Go ${e.direction || ''} to ${e.name || e.target}`,
            roomId: e.target
        }));

        return {
            type: 'room',
            label: `🏠 ${roomLabel}`,
            description: roomData.description ? roomData.description.slice(0, 40) + '...' : undefined,
            tooltip: roomData.description || roomLabel,
            contextValue: 'room',
            children: [
                { type: 'category', label: '📦 Objects', children: objects },
                { type: 'category', label: '🤖 Agents', children: agents },
                { type: 'category', label: '📜 Exits', children: exits },
            ]
        };
    }

    /**
     * Handle a tree node click.
     * Verb nodes → send command to MUD terminal
     * Exit nodes → send "go <direction>" to MUD terminal
     * Object/Agent nodes → open source file
     */
    private handleNodeClick(node: PlatoTreeNode): void {
        if (node.type === 'verb' && node.verbCommand) {
            // Find active MUD terminal and send the verb
            const terminals = vscode.window.terminals;
            const mudTerminal = terminals.find(t => t.name.includes('Plato MUD'));
            if (mudTerminal) {
                mudTerminal.sendText(node.verbCommand);
                mudTerminal.show();
            } else {
                vscode.window.showWarningMessage('No active Plato MUD terminal.');
            }

            this.eventLogger?.log({
                type: 'verb_from_inspector',
                verb: node.verbCommand,
                timestamp: Date.now()
            });
        } else if (node.type === 'exit' && node.roomId) {
            const terminals = vscode.window.terminals;
            const mudTerminal = terminals.find(t => t.name.includes('Plato MUD'));
            if (mudTerminal) {
                mudTerminal.sendText(`go ${node.roomId}`);
                mudTerminal.show();
            }
        } else if (node.filePath) {
            // Open the source file
            const uri = vscode.Uri.file(node.filePath);
            vscode.window.showTextDocument(uri);
        }
    }

    // ─── Helpers ───

    private getCollapsibleState(element: PlatoTreeNode): vscode.TreeItemCollapsibleState {
        if (!element.children || element.children.length === 0) {
            return vscode.TreeItemCollapsibleState.None;
        }
        if (element.type === 'room' || element.type === 'category') {
            return vscode.TreeItemCollapsibleState.Expanded;
        }
        return vscode.TreeItemCollapsibleState.Collapsed;
    }

    private getIcon(element: PlatoTreeNode): vscode.ThemeIcon {
        switch (element.type) {
            case 'room': return new vscode.ThemeIcon('home');
            case 'category': return new vscode.ThemeIcon('folder');
            case 'object': return new vscode.ThemeIcon('package');
            case 'agent': return new vscode.ThemeIcon('person');
            case 'verb': return new vscode.ThemeIcon('play');
            case 'exit': return new vscode.ThemeIcon('arrow-right');
            default: return new vscode.ThemeIcon('circle');
        }
    }

    private titleCase(s: string): string {
        return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
    }
}

/**
 * Object Tree Provider — second tree view showing all objects/agents across rooms.
 * This is the "Objects & Agents" view in the sidebar.
 */
class ObjectTreeProvider implements vscode.TreeDataProvider<PlatoTreeNode> {
    private _onDidChange = new vscode.EventEmitter<PlatoTreeNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    constructor(private readonly mainProvider: RoomInspectorProvider) {}

    refresh(): void { this._onDidChange.fire(undefined); }

    getTreeItem(element: PlatoTreeNode): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.description = element.description;
        item.iconPath = new vscode.ThemeIcon(element.type === 'agent' ? 'person' : 'package');
        return item;
    }

    getChildren(element?: PlatoTreeNode): PlatoTreeNode[] {
        if (!element) {
            // Return a flat list — Phase 2 will query SharedWorldStore
            return [{
                type: 'category',
                label: 'Query SharedWorldStore for live state...',
                description: '(connects when MUD is running)'
            }];
        }
        return [];
    }
}
