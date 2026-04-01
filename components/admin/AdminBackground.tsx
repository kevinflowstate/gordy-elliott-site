export default function AdminBackground() {
  // Node positions (x, y) as percentages
  const nodes = [
    { x: 8, y: 12, r: 5 },
    { x: 22, y: 8, r: 4 },
    { x: 38, y: 18, r: 6 },
    { x: 55, y: 6, r: 4.5 },
    { x: 72, y: 14, r: 5 },
    { x: 88, y: 10, r: 4 },
    { x: 12, y: 35, r: 4.5 },
    { x: 30, y: 42, r: 5 },
    { x: 48, y: 32, r: 4 },
    { x: 65, y: 38, r: 5.5 },
    { x: 82, y: 30, r: 4 },
    { x: 92, y: 42, r: 4.5 },
    { x: 5, y: 58, r: 4 },
    { x: 20, y: 65, r: 5 },
    { x: 42, y: 55, r: 4.5 },
    { x: 58, y: 62, r: 5 },
    { x: 75, y: 52, r: 4 },
    { x: 90, y: 60, r: 5 },
    { x: 15, y: 82, r: 5 },
    { x: 32, y: 78, r: 4 },
    { x: 50, y: 85, r: 5.5 },
    { x: 68, y: 75, r: 4.5 },
    { x: 85, y: 82, r: 4 },
    { x: 95, y: 72, r: 4.5 },
  ];

  // Connections between nodes (index pairs)
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
    [0, 6], [1, 8], [2, 7], [3, 9], [4, 10], [5, 11],
    [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
    [6, 12], [7, 13], [8, 14], [9, 15], [10, 16], [11, 17],
    [12, 13], [13, 14], [14, 15], [15, 16], [16, 17],
    [12, 18], [13, 19], [14, 20], [15, 21], [16, 22], [17, 23],
    [18, 19], [19, 20], [20, 21], [21, 22], [22, 23],
    // Some diagonal cross-connections for visual interest
    [1, 7], [3, 8], [7, 14], [9, 16], [14, 20], [16, 22],
    [2, 9], [8, 15], [13, 20],
  ];

  return (
    <div className="admin-bg fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Subtle grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="admin-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(226,184,48,0.05)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#admin-grid)" />
      </svg>

      {/* Interconnected nodes network */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        {/* Connection lines */}
        {connections.map(([from, to], i) => (
          <line
            key={`line-${i}`}
            x1={nodes[from].x}
            y1={nodes[from].y}
            x2={nodes[to].x}
            y2={nodes[to].y}
            stroke="rgba(226,184,48,0.08)"
            strokeWidth="0.15"
          />
        ))}
        {/* Node circles */}
        {nodes.map((node, i) => (
          <g key={`node-${i}`}>
            {/* Outer glow */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r * 0.6}
              fill="rgba(226,184,48,0.04)"
              stroke="none"
            />
            {/* Node ring */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r * 0.3}
              fill="none"
              stroke="rgba(226,184,48,0.12)"
              strokeWidth="0.15"
            />
            {/* Node centre dot */}
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r * 0.12}
              fill="rgba(226,184,48,0.15)"
              stroke="none"
            />
          </g>
        ))}
      </svg>

      {/* Radial glow accents */}
      <div className="absolute top-[10%] right-[15%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(226,184,48,0.06)_0%,transparent_70%)]" />
      <div className="absolute bottom-[20%] left-[10%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(226,184,48,0.05)_0%,transparent_70%)]" />
    </div>
  );
}
