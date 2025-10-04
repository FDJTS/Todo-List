// Force Graph Manager for Task Relations
class GraphManager {
  constructor(app) {
    this.app = app;
    this.nodes = [];
    this.links = [];
    this.simulation = null;
    this.svg = null;
    this.container = null;
    this.zoom = null;
    this.selectedNode = null;
  }

  show() {
    const modal = document.getElementById('relationshipModal');
    const container = document.getElementById('relationshipGraph');
    
    this.container = container;
    this.setupGraph();
    modal.classList.add('active');
  }

  setupGraph() {
    // Clear previous graph
    this.container.innerHTML = '';
    
    if (this.app.tasks.length === 0) {
      this.container.innerHTML = '<div class="no-data">No tasks available to visualize</div>';
      return;
    }

    // Prepare data
    this.prepareGraphData();
    
    // Create SVG
    const rect = this.container.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 400;
    
    this.svg = this.createSVG(width, height);
    this.container.appendChild(this.svg);
    
    // Setup force simulation
    this.setupSimulation(width, height);
    
    // Render graph
    this.renderGraph();
    
    // Add controls
    this.addGraphControls();
  }

  prepareGraphData() {
    const tasks = this.app.tasks;
    
    // Create nodes
    this.nodes = tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      completed: task.completed,
      priority: task.priority,
      tags: task.tags,
      isOverdue: task.isOverdue(),
      x: Math.random() * 600,
      y: Math.random() * 400
    }));
    
    // Create links from relations
    this.links = [];
    tasks.forEach(task => {
      if (task.relations && task.relations.length > 0) {
        task.relations.forEach(relatedId => {
          // Only add link if target task exists
          if (tasks.find(t => t.id === relatedId)) {
            this.links.push({
              source: task.id,
              target: relatedId,
              id: `${task.id}-${relatedId}`
            });
          }
        });
      }
    });
    
    // Add implicit connections based on shared tags
    this.addTagBasedConnections();
  }

  addTagBasedConnections() {
    const tagGroups = {};
    
    // Group tasks by tags
    this.nodes.forEach(node => {
      node.tags.forEach(tag => {
        if (!tagGroups[tag]) tagGroups[tag] = [];
        tagGroups[tag].push(node.id);
      });
    });
    
    // Create weak links between tasks with shared tags
    Object.values(tagGroups).forEach(taskIds => {
      if (taskIds.length > 1) {
        for (let i = 0; i < taskIds.length; i++) {
          for (let j = i + 1; j < taskIds.length; j++) {
            const linkId = `${taskIds[i]}-${taskIds[j]}`;
            const reverseLinkId = `${taskIds[j]}-${taskIds[i]}`;
            
            // Only add if no explicit relation exists
            const existingLink = this.links.find(l => 
              l.id === linkId || l.id === reverseLinkId
            );
            
            if (!existingLink) {
              this.links.push({
                source: taskIds[i],
                target: taskIds[j],
                id: linkId,
                weak: true, // Tag-based connection
                strength: 0.3
              });
            }
          }
        }
      }
    });
  }

  createSVG(width, height) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.background = 'var(--bg-secondary)';
    svg.style.borderRadius = 'var(--border-radius)';
    
    // Add defs for gradients and patterns
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Add arrowhead marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', 'var(--text-muted)');
    
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
    
    return svg;
  }

  setupSimulation(width, height) {
    // Note: Since we're not using D3, we'll implement a simple force simulation
    this.simulation = {
      nodes: this.nodes,
      links: this.links,
      width,
      height,
      alpha: 1,
      alphaDecay: 0.02,
      forces: {
        charge: -300,
        linkDistance: 100,
        centerX: width / 2,
        centerY: height / 2
      }
    };
    
    this.startSimulation();
  }

  startSimulation() {
    const sim = this.simulation;
    let ticks = 0;
    const maxTicks = 300;
    
    const tick = () => {
      if (ticks++ < maxTicks && sim.alpha > 0.01) {
        this.simulationTick();
        sim.alpha *= (1 - sim.alphaDecay);
        requestAnimationFrame(tick);
      }
      this.updateVisualization();
    };
    
    requestAnimationFrame(tick);
  }

  simulationTick() {
    const nodes = this.simulation.nodes;
    const links = this.simulation.links;
    
    // Apply forces
    this.applyLinkForce(nodes, links);
    this.applyChargeForce(nodes);
    this.applyCenterForce(nodes);
    this.applyBoundaryForce(nodes);
    
    // Update positions
    nodes.forEach(node => {
      node.vx = (node.vx || 0) * 0.9; // Damping
      node.vy = (node.vy || 0) * 0.9;
      node.x += node.vx;
      node.y += node.vy;
    });
  }

  applyLinkForce(nodes, links) {
    links.forEach(link => {
      const source = nodes.find(n => n.id === link.source);
      const target = nodes.find(n => n.id === link.target);
      
      if (source && target) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDistance = link.weak ? 150 : 100;
        
        const force = (distance - targetDistance) / distance * 0.1;
        const fx = dx * force;
        const fy = dy * force;
        
        source.vx = (source.vx || 0) + fx;
        source.vy = (source.vy || 0) + fy;
        target.vx = (target.vx || 0) - fx;
        target.vy = (target.vy || 0) - fy;
      }
    });
  }

  applyChargeForce(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = this.simulation.forces.charge / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        nodeA.vx = (nodeA.vx || 0) - fx;
        nodeA.vy = (nodeA.vy || 0) - fy;
        nodeB.vx = (nodeB.vx || 0) + fx;
        nodeB.vy = (nodeB.vy || 0) + fy;
      }
    }
  }

  applyCenterForce(nodes) {
    const centerX = this.simulation.forces.centerX;
    const centerY = this.simulation.forces.centerY;
    
    nodes.forEach(node => {
      const fx = (centerX - node.x) * 0.01;
      const fy = (centerY - node.y) * 0.01;
      
      node.vx = (node.vx || 0) + fx;
      node.vy = (node.vy || 0) + fy;
    });
  }

  applyBoundaryForce(nodes) {
    const margin = 30;
    const width = this.simulation.width;
    const height = this.simulation.height;
    
    nodes.forEach(node => {
      if (node.x < margin) {
        node.vx = (node.vx || 0) + (margin - node.x) * 0.1;
      }
      if (node.x > width - margin) {
        node.vx = (node.vx || 0) + (width - margin - node.x) * 0.1;
      }
      if (node.y < margin) {
        node.vy = (node.vy || 0) + (margin - node.y) * 0.1;
      }
      if (node.y > height - margin) {
        node.vy = (node.vy || 0) + (height - margin - node.y) * 0.1;
      }
    });
  }

  renderGraph() {
    // Create link elements
    this.simulation.links.forEach(link => {
      const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineElement.setAttribute('stroke', link.weak ? 'var(--border-color)' : 'var(--text-muted)');
      lineElement.setAttribute('stroke-width', link.weak ? 1 : 2);
      lineElement.setAttribute('stroke-dasharray', link.weak ? '3,3' : 'none');
      lineElement.setAttribute('marker-end', 'url(#arrowhead)');
      lineElement.setAttribute('data-link-id', link.id);
      this.svg.appendChild(lineElement);
    });
    
    // Create node elements
    this.simulation.nodes.forEach(node => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-node-id', node.id);
      g.style.cursor = 'pointer';
      
      // Node circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', this.getNodeRadius(node));
      circle.setAttribute('fill', this.getNodeColor(node));
      circle.setAttribute('stroke', node.completed ? 'var(--success-color)' : 'var(--border-color)');
      circle.setAttribute('stroke-width', node.completed ? 3 : 1);
      
      // Node label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '0.35em');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', 'var(--text-primary)');
      text.textContent = this.truncateText(node.title, 12);
      
      g.appendChild(circle);
      g.appendChild(text);
      
      // Add event listeners
      this.addNodeInteractions(g, node);
      
      this.svg.appendChild(g);
    });
    
    this.updateVisualization();
  }

  getNodeRadius(node) {
    let radius = 20;
    
    // Adjust by priority
    switch (node.priority) {
      case 'high': radius = 25; break;
      case 'medium': radius = 20; break;
      case 'low': radius = 15; break;
    }
    
    // Adjust by number of connections
    const connections = this.simulation.links.filter(l => 
      l.source === node.id || l.target === node.id
    ).length;
    radius += connections * 2;
    
    return Math.min(radius, 35);
  }

  getNodeColor(node) {
    if (node.isOverdue) return 'var(--error-color)';
    if (node.completed) return 'var(--success-color)';
    
    switch (node.priority) {
      case 'high': return '#fee2e2';
      case 'medium': return '#fef3c7';
      case 'low': return '#f0fdf4';
      default: return 'var(--bg-primary)';
    }
  }

  addNodeInteractions(element, node) {
    element.addEventListener('click', (e) => {
      this.selectNode(node);
      e.stopPropagation();
    });
    
    element.addEventListener('mouseenter', () => {
      this.highlightNode(node, true);
    });
    
    element.addEventListener('mouseleave', () => {
      if (this.selectedNode !== node) {
        this.highlightNode(node, false);
      }
    });
    
    // Add drag functionality
    this.addDragBehavior(element, node);
  }

  addDragBehavior(element, node) {
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = this.svg.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left - node.x;
      dragOffset.y = e.clientY - rect.top - node.y;
      element.style.cursor = 'grabbing';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const rect = this.svg.getBoundingClientRect();
        node.x = e.clientX - rect.left - dragOffset.x;
        node.y = e.clientY - rect.top - dragOffset.y;
        this.updateVisualization();
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'pointer';
      }
    });
  }

  updateVisualization() {
    // Update link positions
    this.simulation.links.forEach(link => {
      const source = this.simulation.nodes.find(n => n.id === link.source);
      const target = this.simulation.nodes.find(n => n.id === link.target);
      
      if (source && target) {
        const lineElement = this.svg.querySelector(`[data-link-id="${link.id}"]`);
        if (lineElement) {
          lineElement.setAttribute('x1', source.x);
          lineElement.setAttribute('y1', source.y);
          lineElement.setAttribute('x2', target.x);
          lineElement.setAttribute('y2', target.y);
        }
      }
    });
    
    // Update node positions
    this.simulation.nodes.forEach(node => {
      const nodeElement = this.svg.querySelector(`[data-node-id="${node.id}"]`);
      if (nodeElement) {
        nodeElement.setAttribute('transform', `translate(${node.x}, ${node.y})`);
      }
    });
  }

  selectNode(node) {
    // Clear previous selection
    if (this.selectedNode) {
      this.highlightNode(this.selectedNode, false);
    }
    
    this.selectedNode = node;
    this.highlightNode(node, true);
    this.showNodeDetails(node);
  }

  highlightNode(node, highlight) {
    const nodeElement = this.svg.querySelector(`[data-node-id="${node.id}"]`);
    const circle = nodeElement.querySelector('circle');
    
    if (highlight) {
      circle.setAttribute('stroke-width', 4);
      circle.setAttribute('stroke', 'var(--primary-color)');
      
      // Highlight connected nodes
      this.highlightConnections(node.id, true);
    } else {
      circle.setAttribute('stroke-width', node.completed ? 3 : 1);
      circle.setAttribute('stroke', node.completed ? 'var(--success-color)' : 'var(--border-color)');
      
      this.highlightConnections(node.id, false);
    }
  }

  highlightConnections(nodeId, highlight) {
    this.simulation.links.forEach(link => {
      if (link.source === nodeId || link.target === nodeId) {
        const linkElement = this.svg.querySelector(`[data-link-id="${link.id}"]`);
        if (linkElement) {
          linkElement.setAttribute('stroke-width', highlight ? 3 : (link.weak ? 1 : 2));
          linkElement.setAttribute('stroke', highlight ? 'var(--primary-color)' : 
            (link.weak ? 'var(--border-color)' : 'var(--text-muted)'));
        }
      }
    });
  }

  showNodeDetails(node) {
    // Create or update details panel
    let detailsPanel = this.container.querySelector('.node-details');
    
    if (!detailsPanel) {
      detailsPanel = document.createElement('div');
      detailsPanel.className = 'node-details';
      detailsPanel.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        width: 200px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 1rem;
        box-shadow: var(--shadow-md);
        z-index: 10;
      `;
      this.container.appendChild(detailsPanel);
    }
    
    const connections = this.simulation.links.filter(l => 
      l.source === node.id || l.target === node.id
    ).length;
    
    detailsPanel.innerHTML = `
      <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem;">${node.title}</h4>
      <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">
        <div><strong>Status:</strong> ${node.completed ? 'Completed' : 'Pending'}</div>
        <div><strong>Priority:</strong> ${node.priority}</div>
        <div><strong>Tags:</strong> ${node.tags.join(', ') || 'None'}</div>
        <div><strong>Connections:</strong> ${connections}</div>
        ${node.isOverdue ? '<div style="color: var(--error-color);"><strong>⚠️ Overdue</strong></div>' : ''}
      </div>
      <button onclick="todoApp.ui.editTask('${node.id}')" 
              style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.8rem;" 
              class="btn btn-primary">Edit Task</button>
    `;
  }

  addGraphControls() {
    const controls = document.createElement('div');
    controls.className = 'graph-controls';
    controls.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      display: flex;
      gap: 0.5rem;
      z-index: 10;
    `;
    
    controls.innerHTML = `
      <button class="btn btn-secondary" onclick="this.parentElement.parentElement.querySelector('.GraphManager').resetView()">Reset View</button>
      <button class="btn btn-secondary" onclick="this.parentElement.parentElement.querySelector('.GraphManager').toggleLayout()">Toggle Layout</button>
    `;
    
    this.container.appendChild(controls);
  }

  truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}