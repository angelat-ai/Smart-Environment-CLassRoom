import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Html, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { fetchRooms } from '../api'

const CAMERA_PRESETS = {
  free:    { position: [10, 9, 13],  target: [0, 2, 0] },
  top:     { position: [0, 18, 0.1], target: [0, 0, 0] },
  door:    { position: [4, 4, 11],   target: [2, 2, 3] },
  teacher: { position: [-1, 5, -8],  target: [0, 2, -2] },
  corner:  { position: [-10, 7, 8],  target: [0, 2, 0] },
}

function useCameraAnimation(controlsRef, cameraRef) {
  const animateTo = useCallback((preset) => {
    const { position, target } = CAMERA_PRESETS[preset]
    if (!controlsRef.current || !cameraRef.current) return
    gsap.to(cameraRef.current.position, {
      x: position[0], y: position[1], z: position[2],
      duration: 1.4, ease: 'power3.inOut',
    })
    gsap.to(controlsRef.current.target, {
      x: target[0], y: target[1], z: target[2],
      duration: 1.4, ease: 'power3.inOut',
      onUpdate: () => controlsRef.current.update(),
    })
  }, [controlsRef, cameraRef])
  return animateTo
}

function Room({ lightsOn }) {
  const floorMat = { color: '#c4a882', roughness: 0.9 }
  const wallMat  = { color: '#ede8de', roughness: 0.85 }
  const ceilMat  = { color: '#f5f2eb', roughness: 0.7 }
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial {...floorMat} />
      </mesh>
      <mesh position={[0, 5, -6]} receiveShadow>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      <mesh position={[0, 5, 6]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#e8e3d8" roughness={0.85} />
      </mesh>
      <mesh position={[-8, 5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#e0dbd0" roughness={0.85} />
      </mesh>
      <mesh position={[8, 5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial color="#e0dbd0" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 10, 0]} receiveShadow>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial {...ceilMat} />
      </mesh>
      {[-6,-4,-2,0,2,4,6].map((x, i) => (
        <mesh key={`fx${i}`} rotation={[-Math.PI/2,0,0]} position={[x, 0.01, 0]}>
          <planeGeometry args={[0.04, 12]} />
          <meshStandardMaterial color="#b89870" roughness={1} />
        </mesh>
      ))}
      {[-5,-3,-1,1,3,5].map((z, i) => (
        <mesh key={`fz${i}`} rotation={[-Math.PI/2,0,0]} position={[0, 0.01, z]}>
          <planeGeometry args={[16, 0.04]} />
          <meshStandardMaterial color="#b89870" roughness={1} />
        </mesh>
      ))}
      {[
        { pos: [0, 0.08, -5.94], rot: [0,0,0], w: 16 },
        { pos: [0, 0.08, 5.94], rot: [0,Math.PI,0], w: 16 },
        { pos: [-7.94, 0.08, 0], rot: [0,Math.PI/2,0], w: 12 },
        { pos: [7.94, 0.08, 0], rot: [0,-Math.PI/2,0], w: 12 },
      ].map((b, i) => (
        <mesh key={`base${i}`} position={b.pos} rotation={b.rot}>
          <boxGeometry args={[b.w, 0.18, 0.06]} />
          <meshStandardMaterial color="#c8b89a" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 9.94, 0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#f0ece2" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Door({ isOpen }) {
  const doorRef = useRef()
  useEffect(() => {
    if (doorRef.current) {
      gsap.to(doorRef.current.rotation, { y: isOpen ? -Math.PI / 2.1 : 0, duration: 1, ease: 'power2.inOut' })
    }
  }, [isOpen])
  return (
    <group position={[3.5, 0, 5.94]}>
      {[[-1.6,4,0],[1.6,4,0],[0,8,0]].map((p,i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={i<2 ? [0.22,8.1,0.18] : [3.5,0.22,0.18]} />
          <meshStandardMaterial color="#7a5c2a" roughness={0.6} />
        </mesh>
      ))}
      <group position={[-1.6, 0, 0]}>
        <mesh ref={doorRef} position={[1.6, 3.9, 0]}>
          <boxGeometry args={[3.2, 7.8, 0.1]} />
          <meshStandardMaterial color="#9a7040" roughness={0.5} metalness={0.05} />
        </mesh>
        {[[-0.5,2.5],[-0.5,5.5],[0.7,2.5],[0.7,5.5]].map((p,i) => (
          <mesh key={i} position={[p[0]+1.1, p[1], 0.06]}>
            <boxGeometry args={[0.9, 1.8, 0.02]} />
            <meshStandardMaterial color="#8a6030" roughness={0.6} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.6, 3.8, 0.1]}>
        <cylinderGeometry args={[0.055, 0.055, 0.35, 12]} />
        <meshStandardMaterial color="#c8a830" metalness={0.85} roughness={0.15} />
      </mesh>
    </group>
  )
}

function Window({ position, side = 'left', lightsOn = true }) {
  const rot = side === 'right' ? [0, -Math.PI/2, 0] : [0, Math.PI/2, 0]
  return (
    <group position={position} rotation={rot}>
      <mesh>
        <boxGeometry args={[3.2, 2.4, 0.14]} />
        <meshStandardMaterial color="#7a5c2a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[2.9, 2.1, 0.06]} />
        <meshStandardMaterial color="#a8d8f0" transparent opacity={0.28} roughness={0} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.08]}><boxGeometry args={[3, 0.08, 0.06]} /><meshStandardMaterial color="#7a5c2a" /></mesh>
      <mesh position={[0, 0, 0.08]}><boxGeometry args={[0.08, 2.2, 0.06]} /><meshStandardMaterial color="#7a5c2a" /></mesh>
      <mesh position={[0, -1.25, 0.15]}>
        <boxGeometry args={[3.4, 0.1, 0.3]} />
        <meshStandardMaterial color="#d4c8a8" roughness={0.7} />
      </mesh>
      <pointLight position={[0, 0, 3]} intensity={lightsOn ? 0.4 : 1.2} color="#fff5e0" distance={9} />
    </group>
  )
}

function Blackboard() {
  return (
    <group position={[0, 4, -5.8]}>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[9, 3.8, 0.08]} />
        <meshStandardMaterial color="#c8b898" roughness={0.8} />
      </mesh>
      <mesh>
        <boxGeometry args={[8.5, 3.2, 0.12]} />
        <meshStandardMaterial color="#1a3820" roughness={0.98} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[8.1, 2.8, 0.04]} />
        <meshStandardMaterial color="#1e4825" roughness={1} />
      </mesh>
      {[0.6, 0.1, -0.4, -0.7].map((y, i) => (
        <mesh key={i} position={[i % 2 === 0 ? -1.5 : 1, y, 0.1]}>
          <boxGeometry args={[i % 2 === 0 ? 2 : 2.5, 0.055, 0.02]} />
          <meshStandardMaterial color="#c8c8c8" roughness={0.9} transparent opacity={0.5} />
        </mesh>
      ))}
      {[
        [0, -1.68, 0, 8.7, 0.14, 0.22],
        [0, 1.68, 0, 8.7, 0.14, 0.22],
        [-4.37, 0, 0, 0.14, 3.5, 0.22],
        [4.37, 0, 0, 0.14, 3.5, 0.22],
      ].map((f, i) => (
        <mesh key={i} position={[f[0],f[1],f[2]]}>
          <boxGeometry args={[f[3],f[4],f[5]]} />
          <meshStandardMaterial color="#5c3a1e" roughness={0.65} />
        </mesh>
      ))}
      <mesh position={[0, -1.78, 0.18]}>
        <boxGeometry args={[8.5, 0.12, 0.28]} />
        <meshStandardMaterial color="#6b4820" roughness={0.6} />
      </mesh>
      <mesh position={[2.5, -1.72, 0.3]}>
        <boxGeometry args={[0.55, 0.25, 0.18]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.85} />
      </mesh>
      {[-1, 0, 1].map((x, i) => (
        <mesh key={i} position={[x * 0.4 + 3.5, -1.72, 0.25]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.28, 8]} />
          <meshStandardMaterial color={['#ffffff','#ffccaa','#aaddff'][i]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function TeacherDesk() {
  return (
    <group position={[0, 0, -3.8]}>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 0.09, 1.4]} />
        <meshStandardMaterial color="#8B4513" roughness={0.55} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[3.5, 0.76, 1.38]} />
        <meshStandardMaterial color="#7a3c10" roughness={0.65} />
      </mesh>
      {[[-1, 0.62],[1, 0.62],[-1, 0.3],[1, 0.3]].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0.7]}>
          <boxGeometry args={[0.9, 0.28, 0.04]} />
          <meshStandardMaterial color="#8a4520" roughness={0.6} />
        </mesh>
      ))}
      {[[-1, 0.62],[1, 0.62],[-1, 0.3],[1, 0.3]].map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0.74]}>
          <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
          <meshStandardMaterial color="#c0a020" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0.9, 1.05, 0.1]} castShadow>
        <boxGeometry args={[0.6, 0.4, 0.06]} />
        <meshStandardMaterial color="#111122" roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh position={[0.9, 1.05, 0.13]}>
        <boxGeometry args={[0.55, 0.35, 0.01]} />
        <meshStandardMaterial color="#1a2a3a" roughness={0.1} emissive="#0a1520" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.9, 0.9, 0.12]}>
        <boxGeometry args={[0.08, 0.14, 0.06]} />
        <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
      </mesh>
      {[[-0.5, 0.88, 0.2],[0.1, 0.88, -0.1]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, i * 0.15, 0]}>
          <boxGeometry args={[0.55, 0.01, 0.42]} />
          <meshStandardMaterial color="#f5f5f0" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[-1.1, 0.92, 0.1]}>
        <cylinderGeometry args={[0.07, 0.06, 0.12, 12]} />
        <meshStandardMaterial color="#8B4513" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Book({ position, color, rotation = [0,0,0] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[0.22, 0.28, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <boxGeometry args={[0.2, 0.26, 0.002]} />
        <meshStandardMaterial color="#f5f5f0" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Bag({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.35, 0.42, 0.18]} />
        <meshStandardMaterial color="#2a4a8a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.25, 0.05]}>
        <boxGeometry args={[0.2, 0.06, 0.04]} />
        <meshStandardMaterial color="#1a3a7a" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.05, 0.1]}>
        <boxGeometry args={[0.28, 0.2, 0.04]} />
        <meshStandardMaterial color="#1a3a7a" roughness={0.8} />
      </mesh>
    </group>
  )
}

function StudentDesk({ position, hasBag = false, hasBooks = false }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.07, 0.75]} />
        <meshStandardMaterial color="#a07848" roughness={0.6} />
      </mesh>
      {[[-0.47,-0.25],[-0.47,0.28],[0.47,-0.25],[0.47,0.28]].map((p, i) => (
        <mesh key={i} position={[p[0], 0.32, p[1]]} castShadow>
          <boxGeometry args={[0.07, 0.64, 0.07]} />
          <meshStandardMaterial color="#7a5228" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0.6]} castShadow>
        <boxGeometry args={[0.92, 0.55, 0.07]} />
        <meshStandardMaterial color="#8B6040" roughness={0.7} />
      </mesh>
      {[[-0.38, 0.55],[0.38, 0.55]].map((p, i) => (
        <mesh key={i} position={[p[0], 0.1, p[1]]} castShadow>
          <boxGeometry args={[0.07, 0.55, 0.07]} />
          <meshStandardMaterial color="#7a5228" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.38, 0.55]} castShadow>
        <boxGeometry args={[0.88, 0.06, 0.5]} />
        <meshStandardMaterial color="#9a7050" roughness={0.65} />
      </mesh>
      {hasBooks && (
        <>
          <Book position={[-0.3, 0.76, -0.1]} color="#c84040" />
          <Book position={[-0.05, 0.76, -0.08]} color="#4060c8" rotation={[0, 0.1, 0]} />
        </>
      )}
      {hasBag && <Bag position={[0.35, 0.02, 0.7]} />}
    </group>
  )
}

function CeilingLight({ position, isOn, index }) {
  const lightRef    = useRef()
  const glowRef     = useRef()
  const pointLightRef = useRef()
  const flickerRef  = useRef(false)

  useEffect(() => {
    if (!lightRef.current || !glowRef.current) return
    if (isOn && !flickerRef.current) {
      flickerRef.current = true
      const tl = gsap.timeline()
      tl.to(lightRef.current.material,   { emissiveIntensity: 3, duration: 0.08 })
        .to(lightRef.current.material,   { emissiveIntensity: 0.5, duration: 0.06 })
        .to(lightRef.current.material,   { emissiveIntensity: 2.8, duration: 0.1 })
        .to(lightRef.current.material,   { emissiveIntensity: 2.5, duration: 0.4 })
      gsap.to(glowRef.current.material,  { opacity: 0.75, duration: 0.65, ease: 'power2.inOut' })
      if (pointLightRef.current) gsap.to(pointLightRef.current, { intensity: 4, duration: 0.65 })
    } else if (!isOn) {
      flickerRef.current = false
      gsap.to(lightRef.current.material, { emissiveIntensity: 0, duration: 0.5 })
      gsap.to(glowRef.current.material,  { opacity: 0, duration: 0.5 })
      if (pointLightRef.current) gsap.to(pointLightRef.current, { intensity: 0, duration: 0.5 })
    }
  }, [isOn])

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.65, 0.06, 0.65]} />
        <meshStandardMaterial color="#999" metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.055, 0]}>
        <boxGeometry args={[0.58, 0.02, 0.58]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh ref={glowRef} position={[0, -0.05, 0]}>
        <boxGeometry args={[0.55, 0.01, 0.55]} />
        <meshStandardMaterial color="#fffde7" transparent opacity={0} emissive="#fffde7" emissiveIntensity={1} />
      </mesh>
      <mesh ref={lightRef} position={[0, -0.04, 0]}>
        <boxGeometry args={[0.52, 0.01, 0.52]} />
        <meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={0} roughness={0.1} />
      </mesh>
      <pointLight ref={pointLightRef} position={[0, -0.25, 0]} intensity={0} color="#fff8e1" distance={9} castShadow shadow-mapSize={512} />
    </group>
  )
}

function PIRSensor({ isActive }) {
  const sensorRef = useRef()
  const coneRef   = useRef()
  useEffect(() => {
    if (sensorRef.current) {
      gsap.to(sensorRef.current.material, { emissiveIntensity: isActive ? 2.5 : 0.2, duration: 0.3 })
    }
    if (coneRef.current) {
      gsap.to(coneRef.current.material, { opacity: isActive ? 0.12 : 0, duration: 0.4 })
    }
  }, [isActive])
  return (
    <group position={[2.5, 9.5, 5.6]}>
      <mesh>
        <boxGeometry args={[0.28, 0.22, 0.16]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh ref={sensorRef} position={[0, 0, 0.1]}>
        <sphereGeometry args={[0.09, 14, 14]} />
        <meshStandardMaterial
          color={isActive ? '#ff3333' : '#883333'}
          emissive={isActive ? '#ff2222' : '#220000'}
          emissiveIntensity={0.2}
          roughness={0.1} metalness={0.2}
        />
      </mesh>
      <mesh ref={coneRef} position={[0, -1.5, 0.1]} rotation={[Math.PI/2, 0, 0]}>
        <coneGeometry args={[1.2, 3, 16, 1, true]} />
        <meshStandardMaterial color="#ff4444" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
      {isActive && <pointLight position={[0, -0.5, 0.3]} intensity={0.6} color="#ff4444" distance={4} />}
      <Html position={[0, 0.28, 0]} center>
        <div style={{
          background: isActive ? 'rgba(255,40,40,0.92)' : 'rgba(15,15,15,0.82)',
          color: 'white', padding: '2px 7px', borderRadius: 4,
          fontSize: 9, whiteSpace: 'nowrap', fontFamily: 'monospace',
          border: `1px solid ${isActive ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.1)'}`,
        }}>
          PIR {isActive ? '● MOTION' : '○ IDLE'}
        </div>
      </Html>
    </group>
  )
}

function ESP32Board({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.7, 0.05, 0.35]} />
        <meshStandardMaterial color="#1a5c22" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[-0.35, 0, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.08]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.18, 0.055, 0]}>
        <boxGeometry args={[0.22, 0.06, 0.18]} />
        <meshStandardMaterial color="#c87820" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[0.18, 0.085, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.14]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.2} metalness={0.8} />
      </mesh>
      {[-0.28,-0.18,-0.08,0.02,0.08,0.18,0.28].map((x, i) => (
        <React.Fragment key={i}>
          <mesh position={[x, -0.04, -0.16]}>
            <boxGeometry args={[0.03, 0.06, 0.03]} />
            <meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[x, -0.04, 0.16]}>
            <boxGeometry args={[0.03, 0.06, 0.03]} />
            <meshStandardMaterial color="#c0a020" metalness={0.9} roughness={0.1} />
          </mesh>
        </React.Fragment>
      ))}
      <mesh position={[-0.1, 0.06, -0.1]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 0.3, 0]} intensity={0.5} color="#00ff88" distance={1.5} />
      <Html position={[0, 0.25, 0]} center>
        <div style={{ background: 'rgba(0,25,8,0.9)', color: '#00ff88', padding: '2px 7px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(0,255,136,0.3)' }}>ESP32</div>
      </Html>
    </group>
  )
}

function RelayModule({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.5, 0.05, 0.28]} />
        <meshStandardMaterial color="#0a3a7a" roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[0.08, 0.06, 0]}>
        <boxGeometry args={[0.18, 0.08, 0.16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[-0.16, 0.04, 0]}>
        <boxGeometry args={[0.12, 0.06, 0.22]} />
        <meshStandardMaterial color="#1a7a3a" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0.2, 0.07, 0.08]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff2222" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.2, 0.07, -0.08]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#22ff22" emissive="#22ff22" emissiveIntensity={1.5} />
      </mesh>
      <Html position={[0, 0.22, 0]} center>
        <div style={{ background: 'rgba(0,0,30,0.9)', color: '#4488ff', padding: '2px 7px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', whiteSpace: 'nowrap', border: '1px solid rgba(68,136,255,0.3)' }}>RELAY</div>
      </Html>
    </group>
  )
}

function Breadboard({ position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.6, 0.03, 0.2]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.7} />
      </mesh>
      {[-0.08, 0.08].map((z, i) => (
        <mesh key={i} position={[0, 0.02, z]}>
          <boxGeometry args={[0.58, 0.01, 0.025]} />
          <meshStandardMaterial color={i === 0 ? '#cc4444' : '#4444cc'} roughness={0.5} />
        </mesh>
      ))}
      {[-0.22,-0.12,-0.02,0.08,0.18].map((x,i) =>
        [-0.05,0,0.05].map((z,j) => (
          <mesh key={`${i}-${j}`} position={[x, 0.02, z]}>
            <boxGeometry args={[0.015, 0.01, 0.015]} />
            <meshStandardMaterial color="#888" metalness={0.7} roughness={0.3} />
          </mesh>
        ))
      )}
    </group>
  )
}

function WallClock({ position }) {
  const secondHandRef = useRef()
  useFrame(() => {
    if (secondHandRef.current) {
      const now = new Date()
      secondHandRef.current.rotation.z = -(now.getSeconds() / 60) * Math.PI * 2
    }
  })
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.35, 0.35, 0.06, 32]} />
        <meshStandardMaterial color="#f0ece0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <circleGeometry args={[0.32, 32]} />
        <meshStandardMaterial color="#fafaf5" roughness={0.5} />
      </mesh>
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(h => {
        const a = (h / 12) * Math.PI * 2
        return (
          <mesh key={h} position={[Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.045]}>
            <boxGeometry args={[0.025, 0.06, 0.01]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        )
      })}
      <mesh position={[0, 0.08, 0.05]} rotation={[0, 0, -0.8]}>
        <boxGeometry args={[0.03, 0.18, 0.01]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 0.11, 0.05]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.02, 0.24, 0.01]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh ref={secondHandRef} position={[0, 0.12, 0.055]}>
        <boxGeometry args={[0.01, 0.28, 0.008]} />
        <meshStandardMaterial color="#cc2222" />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <circleGeometry args={[0.025, 16]} />
        <meshStandardMaterial color="#cc2222" />
      </mesh>
    </group>
  )
}

function TrashBin({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.13, 0.1, 0.4, 12]} />
        <meshStandardMaterial color="#555" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.41, 0]}>
        <cylinderGeometry args={[0.135, 0.135, 0.03, 12]} />
        <meshStandardMaterial color="#444" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  )
}

function CornerShelf() {
  return (
    <group position={[-7.5, 0, -5.5]}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.9, 2.0, 0.75]} />
        <meshStandardMaterial color="#8B5e3c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.05, 0]}>
        <boxGeometry args={[0.95, 0.06, 0.8]} />
        <meshStandardMaterial color="#7a4e2c" roughness={0.6} />
      </mesh>
      {[-0.22, 0.22].map((x, i) => (
        <mesh key={i} position={[x, 1.0, 0.38]}>
          <boxGeometry args={[0.38, 1.85, 0.04]} />
          <meshStandardMaterial color="#9a6e4c" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0.04, 1.0, 0.41]}>
        <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} rotation={[0, 0, Math.PI/2]} />
        <meshStandardMaterial color="#c0a020" metalness={0.8} roughness={0.2} />
      </mesh>
      {[
        { pos: [-0.25, 2.14, 0], color: '#c04030' },
        { pos: [-0.02, 2.14, 0], color: '#306090' },
        { pos: [0.2, 2.14, 0],  color: '#408840' },
      ].map((b, i) => (
        <Book key={i} position={[b.pos[0], b.pos[1], b.pos[2]]} color={b.color} />
      ))}
      <mesh position={[0.32, 2.2, 0.1]}>
        <cylinderGeometry args={[0.07, 0.055, 0.12, 10]} />
        <meshStandardMaterial color="#b05020" roughness={0.8} />
      </mesh>
      <mesh position={[0.32, 2.28, 0.1]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color="#2a7a2a" roughness={0.9} />
      </mesh>
    </group>
  )
}

function InfoPanel({ room, isOn, motionActive }) {
  return (
    <Html position={[-7.0, 7.0, -5.8]} center>
      <div style={{
        background: 'rgba(6,12,10,0.94)',
        border: '1px solid rgba(0,200,150,0.35)',
        borderRadius: 10, padding: '12px 16px',
        color: 'white', fontFamily: 'monospace',
        fontSize: 11, minWidth: 170,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: '#00c896', fontWeight: 700, marginBottom: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00c896', display: 'inline-block', animation: 'livePulse 1.8s infinite' }} />
          LIVE STATUS
        </div>
        <div style={{ marginBottom: 4 }}>Lights: <span style={{ color: isOn ? '#00c896' : '#ef4444', fontWeight: 600 }}>{isOn ? 'ON' : 'OFF'}</span></div>
        <div style={{ marginBottom: 4 }}>Motion: <span style={{ color: motionActive ? '#f59e0b' : '#8fa898' }}>{motionActive ? 'DETECTED' : 'NONE'}</span></div>
        <div style={{ marginBottom: 4 }}>Room: <span style={{ color: '#8fa898' }}>{room?.name || 'A'}</span></div>
        <div>Energy: <span style={{ color: '#00c896' }}>{(room?.energy_saved_today || 0).toFixed(2)} kWh</span></div>
      </div>
    </Html>
  )
}

function CameraController({ activePreset, controlsRef }) {
  const { camera } = useThree()
  const cameraRef = useRef(camera)
  cameraRef.current = camera

  useEffect(() => {
    if (!activePreset || !controlsRef.current) return
    const { position, target } = CAMERA_PRESETS[activePreset]
    gsap.to(camera.position, { x: position[0], y: position[1], z: position[2], duration: 1.4, ease: 'power3.inOut' })
    gsap.to(controlsRef.current.target, {
      x: target[0], y: target[1], z: target[2],
      duration: 1.4, ease: 'power3.inOut',
      onUpdate: () => controlsRef.current?.update(),
    })
  }, [activePreset])

  return null
}

function Scene({ roomData, lightsOn, motionActive, activePreset }) {
  const controlsRef = useRef()

  const studentConfig = [
    { pos: [-3.8, 0, -1.2], hasBag: true,  hasBooks: false },
    { pos: [-1.8, 0, -1.2], hasBag: false, hasBooks: true  },
    { pos: [ 0.2, 0, -1.2], hasBag: true,  hasBooks: true  },
    { pos: [ 2.2, 0, -1.2], hasBag: false, hasBooks: false },
    { pos: [ 4.2, 0, -1.2], hasBag: true,  hasBooks: false },
    { pos: [-3.8, 0,  1.0], hasBag: false, hasBooks: true  },
    { pos: [-1.8, 0,  1.0], hasBag: true,  hasBooks: false },
    { pos: [ 0.2, 0,  1.0], hasBag: false, hasBooks: false },
    { pos: [ 2.2, 0,  1.0], hasBag: true,  hasBooks: true  },
    { pos: [ 4.2, 0,  1.0], hasBag: false, hasBooks: true  },
    { pos: [-3.8, 0,  3.2], hasBag: true,  hasBooks: false },
    { pos: [-1.8, 0,  3.2], hasBag: false, hasBooks: false },
    { pos: [ 0.2, 0,  3.2], hasBag: true,  hasBooks: true  },
    { pos: [ 2.2, 0,  3.2], hasBag: false, hasBooks: false },
    { pos: [ 4.2, 0,  3.2], hasBag: true,  hasBooks: true  },
  ]

  const lightPositions = [
    [-4, 9.9, -3], [0, 9.9, -3], [4, 9.9, -3],
    [-4, 9.9,  0], [0, 9.9,  0], [4, 9.9,  0],
    [-4, 9.9,  3], [0, 9.9,  3], [4, 9.9,  3],
  ]

  return (
    <>
      <CameraController activePreset={activePreset} controlsRef={controlsRef} />

      <ambientLight intensity={lightsOn ? 0.55 : 0.12} color="#fff5e8" />
      <directionalLight
        position={[-5, 8, 4]} intensity={lightsOn ? 0.2 : 0.5}
        color="#ffe8c0" castShadow
        shadow-mapSize={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-8, 5, -2]} intensity={lightsOn ? 0.3 : 0.9} color="#ffe8d0" distance={12} />
      <pointLight position={[-8, 5,  2]} intensity={lightsOn ? 0.3 : 0.9} color="#ffe8d0" distance={12} />
      <pointLight position={[ 8, 5, -2]} intensity={lightsOn ? 0.3 : 0.9} color="#ffe8d0" distance={12} />

      <Room lightsOn={lightsOn} />
      <Door isOpen={motionActive} />

      <Window position={[-8, 5, -2.5]} side="left" lightsOn={lightsOn} />
      <Window position={[-8, 5,  2.5]} side="left" lightsOn={lightsOn} />
      <Window position={[ 8, 5, -2.5]} side="right" lightsOn={lightsOn} />

      <Blackboard />
      <TeacherDesk />

      {studentConfig.map((cfg, i) => (
        <StudentDesk key={i} position={cfg.pos} hasBag={cfg.hasBag} hasBooks={cfg.hasBooks} />
      ))}

      {lightPositions.map((pos, i) => (
        <CeilingLight key={i} position={pos} isOn={lightsOn} index={i} />
      ))}

      <PIRSensor isActive={motionActive} />

      <ESP32Board   position={[6.5, 0.92, 4.0]} />
      <RelayModule  position={[6.5, 0.82, 4.8]} />
      <Breadboard   position={[6.5, 0.88, 5.4]} />

      <WallClock   position={[-7.85, 7.5, -3.5]} rotation={[0, Math.PI/2, 0]} />
      <TrashBin    position={[-7.2, 0, 4.5]} />
      <CornerShelf />

      <group position={[-7.4, 0, 3.6]} rotation={[0, 0.2, 0.12]}>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.7, 8]} />
          <meshStandardMaterial color="#8B4513" roughness={0.8} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.22, 0.14, 0.08]} />
          <meshStandardMaterial color="#c8a020" roughness={0.9} />
        </mesh>
      </group>

      <InfoPanel room={roomData} isOn={lightsOn} motionActive={motionActive} />

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={24}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.05}
        dampingFactor={0.07}
        enableDamping={true}
      />
    </>
  )
}

export default function Classroom3DPage() {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState('A')
  const [lightsOn, setLightsOn] = useState(false)
  const [motionActive, setMotionActive] = useState(false)
  const [activePreset, setActivePreset] = useState(null)
  const pollRef = useRef(null)

  const loadData = useCallback(async () => {
    try {
      const data = await fetchRooms()
      setRooms(data)
      const room = data.find(r => r.name === selectedRoom)
      if (room) {
        setLightsOn(room.is_active)
        const lastMotion = room.last_motion ? new Date(room.last_motion).getTime() : 0
        setMotionActive(room.occupancy && (Date.now() - lastMotion) < 15000)
      }
    } catch {}
  }, [selectedRoom])

  useEffect(() => { loadData() }, [selectedRoom])
  useEffect(() => {
    pollRef.current = setInterval(loadData, 5000)
    return () => clearInterval(pollRef.current)
  }, [loadData])

  const currentRoom = rooms.find(r => r.name === selectedRoom)

  const presetButtons = [
    { key: 'free',    label: '⟲ Free' },
    { key: 'top',     label: '↑ Top' },
    { key: 'door',    label: '⛶ Door' },
    { key: 'teacher', label: '🎓 Teacher' },
    { key: 'corner',  label: '◤ Corner' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 16px 0', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.4rem', color: 'var(--text-1)', fontWeight: 400 }}>3D Classroom View</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 2 }}>Scroll to zoom · Drag to orbit · Right-click to pan</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {presetButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActivePreset(key)}
                style={{
                  padding: '5px 10px', borderRadius: 7, fontSize: '0.72rem', fontWeight: 500,
                  border: `1px solid ${activePreset === key ? 'var(--green)' : 'var(--border)'}`,
                  background: activePreset === key ? 'var(--green-dim)' : 'var(--surface)',
                  color: activePreset === key ? 'var(--green)' : 'var(--text-2)',
                  cursor: 'pointer', fontFamily: 'Geist, sans-serif', transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>
          <select
            className="room-select"
            value={selectedRoom}
            onChange={e => setSelectedRoom(e.target.value)}
            style={{ fontSize: '0.83rem' }}
          >
            {rooms.map(r => <option key={r.id} value={r.name}>Room {r.name}</option>)}
          </select>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: lightsOn ? 'rgba(0,200,150,0.1)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${lightsOn ? 'rgba(0,200,150,0.3)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600,
            color: lightsOn ? 'var(--green)' : 'var(--red)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: lightsOn ? 'var(--green)' : 'var(--red)', display: 'inline-block',
              animation: lightsOn ? 'livePulse 1.8s infinite' : 'none',
            }} />
            Lights {lightsOn ? 'ON' : 'OFF'}
          </div>
          {motionActive && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              Motion Detected
            </div>
          )}
        </div>
      </div>

      <div style={{
        flex: 1, borderRadius: 14, overflow: 'hidden',
        border: '1px solid var(--border)', background: '#08100c',
        minHeight: 540, position: 'relative',
      }}>
        <Canvas
          shadows
          camera={{ position: [10, 9, 13], fov: 52 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: lightsOn ? 1.05 : 0.38,
          }}
        >
          <Scene
            roomData={currentRoom}
            lightsOn={lightsOn}
            motionActive={motionActive}
            activePreset={activePreset}
          />
        </Canvas>

        <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'none' }}>
          {[
            { color: '#00c896', label: 'Ceiling Lights' },
            { color: '#f59e0b', label: 'PIR Sensor (Door)' },
            { color: '#4488ff', label: 'ESP32 + Relay' },
            { color: '#8B6914', label: 'Furniture' },
            { color: '#2a7a2a', label: 'Props & Details' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,0.65)', borderRadius: 6, padding: '4px 10px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontFamily: 'monospace' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {activePreset && (
          <div style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(0,200,150,0.12)', border: '1px solid rgba(0,200,150,0.3)',
            borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem',
            color: 'var(--green)', fontFamily: 'monospace', pointerEvents: 'none',
          }}>
            {presetButtons.find(p => p.key === activePreset)?.label} View
          </div>
        )}
      </div>
    </div>
  )
}