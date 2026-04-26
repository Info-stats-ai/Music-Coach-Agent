import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '@/store/useAppStore';
import type { EmotionType } from '@/types';

// Emotion → color/expression mapping
const EMOTION_CONFIG: Record<EmotionType, { color: string; headBob: number; eyeScale: number }> = {
  neutral:      { color: '#6366f1', headBob: 0.02, eyeScale: 1.0 },
  happy:        { color: '#22c55e', headBob: 0.05, eyeScale: 1.2 },
  concerned:    { color: '#f59e0b', headBob: 0.01, eyeScale: 0.8 },
  encouraging:  { color: '#3b82f6', headBob: 0.04, eyeScale: 1.1 },
  thinking:     { color: '#8b5cf6', headBob: 0.015, eyeScale: 0.9 },
};

function CoachFigure() {
  const headRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);

  const emotion = useAppStore((s) => s.currentEmotion);
  const isSpeaking = useAppStore((s) => s.isSpeaking);

  const config = EMOTION_CONFIG[emotion];
  const bodyColor = useMemo(() => new THREE.Color(config.color), [config.color]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Head bob
    if (headRef.current) {
      headRef.current.position.y = 1.6 + Math.sin(t * 2) * config.headBob;
      // Slight nod when speaking
      if (isSpeaking) {
        headRef.current.rotation.x = Math.sin(t * 4) * 0.05;
      } else {
        headRef.current.rotation.x = 0;
      }
    }

    // Eye blink
    const blinkCycle = Math.sin(t * 0.5) > 0.95;
    const eyeScaleY = blinkCycle ? 0.1 : config.eyeScale;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY;

    // Body breathing
    if (bodyRef.current) {
      bodyRef.current.scale.x = 1 + Math.sin(t * 1.5) * 0.01;
      bodyRef.current.scale.z = 1 + Math.sin(t * 1.5) * 0.01;
    }
  });

  return (
    <group>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 8, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      {/* Eyes */}
      <mesh ref={leftEyeRef} position={[-0.08, 1.65, 0.22]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh ref={rightEyeRef} position={[0.08, 1.65, 0.22]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Pupils */}
      <mesh position={[-0.08, 1.65, 0.255]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial color="#1e1e2e" />
      </mesh>
      <mesh position={[0.08, 1.65, 0.255]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial color="#1e1e2e" />
      </mesh>

      {/* Mouth (speaking indicator) */}
      <mesh position={[0, 1.52, 0.23]} scale={[1, isSpeaking ? 1.5 : 0.5, 1]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color="#1e1e2e" />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.45, 0.9, 0]} rotation={[0, 0, 0.3]}>
        <capsuleGeometry args={[0.06, 0.5, 4, 8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0.45, 0.9, 0]} rotation={[0, 0, -0.3]}>
        <capsuleGeometry args={[0.06, 0.5, 4, 8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
    </group>
  );
}

export function Avatar() {
  const emotion = useAppStore((s) => s.currentEmotion);

  return (
    <div className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
      <Canvas camera={{ position: [0, 1.2, 2.5], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} />
        <CoachFigure />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      {/* Emotion badge */}
      <div className="absolute top-3 right-3 bg-black/50 rounded-full px-3 py-1 text-xs font-mono capitalize">
        {emotion}
      </div>
    </div>
  );
}
