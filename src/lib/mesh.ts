import { MeshNode } from '../types';

const LEGACY_MESH_RANGE = 120;
const REAL_MESH_RANGE = 1000; // 1km

function getDistance(n1: MeshNode, n2: MeshNode): number {
  if (n1.lat !== undefined && n1.lng !== undefined && n2.lat !== undefined && n2.lng !== undefined) {
    const dx = (n2.lng - n1.lng) * Math.cos((n1.lat + n2.lat) / 2 * Math.PI / 180) * 111320;
    const dy = (n2.lat - n1.lat) * 111000;
    return Math.sqrt(dx * dx + dy * dy);
  }
  if (n1.x !== undefined && n1.y !== undefined && n2.x !== undefined && n2.y !== undefined) {
    return Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
  }
  return Infinity;
}

function getMeshRange(n1: MeshNode, n2: MeshNode): number {
  if (n1.lat !== undefined && n1.lng !== undefined && n2.lat !== undefined && n2.lng !== undefined) {
    return REAL_MESH_RANGE;
  }
  return LEGACY_MESH_RANGE;
}

export function calculateMeshPaths(nodes: MeshNode[], startNodeId: string) {
  const paths: Record<string, string[]> = {};
  const queue: string[] = [startNodeId];
  const visited = new Set<string>([startNodeId]);
  paths[startNodeId] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodes.find(n => n.id === currentId);
    if (!currentNode) continue;

    for (const neighbor of nodes) {
      if (visited.has(neighbor.id) || !neighbor.isOnline) continue;

      const dist = getDistance(currentNode, neighbor);

      if (dist <= getMeshRange(currentNode, neighbor)) {
        visited.add(neighbor.id);
        paths[neighbor.id] = [...paths[currentId], currentId];
        queue.push(neighbor.id);
      }
    }
  }

  return paths;
}

export function getRelayPath(nodes: MeshNode[], senderId: string, receiverId: string): string[] | null {
  const paths = calculateMeshPaths(nodes, senderId);
  return paths[receiverId] || null;
}

/**
 * Finds the best next node to forward a message to reach receiverId.
 * Using a simple greedy approach: pick the neighbor closest to the receiver.
 */
export function findNextHop(nodes: MeshNode[], currentId: string, receiverId: string): string | null {
  const currentNode = nodes.find(n => n.id === currentId);
  const receiverNode = nodes.find(n => n.id === receiverId);
  if (!currentNode || !receiverNode) return null;

  let bestNextHop: string | null = null;
  let minDistance = Infinity;

  // Potential relays must be online and within range of current node
  const neighbors = nodes.filter(n => 
    n.id !== currentId && 
    n.isOnline && 
    getDistance(currentNode, n) <= getMeshRange(currentNode, n)
  );

  for (const neighbor of neighbors) {
    const distToReceiver = getDistance(neighbor, receiverNode);
    if (distToReceiver < minDistance) {
      minDistance = distToReceiver;
      bestNextHop = neighbor.id;
    }
  }

  return bestNextHop;
}
