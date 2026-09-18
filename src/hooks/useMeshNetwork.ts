// src/hooks/useMeshNetwork.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { MeshManager } from '../utils/meshManager';
import { MeshNode, Message } from '../types';

export function useMeshNetwork(
  currentUser: { uid: string; displayName?: string },
  socket?: any,
  onMessage?: (msg: Message) => void
) {
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'connected'>('idle');
  const [myNode, setMyNode] = useState<MeshNode>(() => MeshManager.getInstance().getMyNode());
  const mesh = useRef(MeshManager.getInstance()).current;
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!currentUser || !currentUser.uid) return;

    mesh.init(currentUser, socket).then(() => {
      setMyNode({ ...mesh.getMyNode() });
    });

    const handleNodes = (updatedNodes: MeshNode[]) => {
      setNodes(updatedNodes);
      setStatus(updatedNodes.length > 0 ? 'connected' : 'scanning');
    };

    const handleStatus = (newStatus: 'idle' | 'scanning' | 'connected') => {
      setStatus(newStatus);
    };

    const handleIncomingMessage = (msg: Message) => {
      console.log('[Mesh] Получено сообщение из сети:', msg);
      if (onMessageRef.current) {
        onMessageRef.current(msg);
      }
    };

    mesh.on('nodesUpdated', handleNodes);
    mesh.on('statusChange', handleStatus);
    mesh.on('messageReceived', handleIncomingMessage);

    return () => {
      mesh.off('nodesUpdated', handleNodes);
      mesh.off('statusChange', handleStatus);
      mesh.off('messageReceived', handleIncomingMessage);
    };
  }, [currentUser?.uid, socket]);

  const sendMeshBroadcast = useCallback(async (text: string) => {
    const node = mesh.getMyNode();
    const packet: Partial<Message> = {
      chatId: 'mesh_broadcast',
      senderId: node.id,
      text: text,
      content: text,
      type: 'text',
      createdAt: new Date().toISOString(),
      deliveryStatus: 'sending',
      ttl: 7
    };
    return await mesh.sendMessage(packet);
  }, [mesh]);

  const sendDirectMeshMessage = useCallback(async (receiverId: string, text: string) => {
    const node = mesh.getMyNode();
    const packet: Partial<Message> = {
      receiverId: receiverId,
      chatId: receiverId,
      senderId: node.id,
      text: text,
      content: text,
      type: 'text',
      createdAt: new Date().toISOString(),
      deliveryStatus: 'sending',
      ttl: 5
    };
    return await mesh.sendMessage(packet);
  }, [mesh]);

  return {
    nodes,
    status,
    myNode,
    sendMeshBroadcast,
    sendDirectMeshMessage,
    connectToPeer: (node: MeshNode) => mesh.connectToPeer(node)
  };
}
