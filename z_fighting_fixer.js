(function() {
  
  let detectAction, fixAction, settingsAction;
  let settings = {
    inflateAmount: 0.05,
    tolerance: 0.001,
    autoRecheck: true
  };
  
  Plugin.register('z_fighting_fixer', {
    title: 'Z-Fighting Fixer',
    author: 'Claude',
    description: 'Detects and automatically fixes z-fighting issues',
    icon: 'build',
    version: '2.0.0',
    variant: 'both',
    
    onload() {
      // Settings action
      settingsAction = new Action('z_fighting_settings', {
        name: 'Z-Fighting Settings',
        description: 'Configure z-fighting fixer settings',
        icon: 'settings',
        click: function() {
          showSettings();
        }
      });
      
      // Detect action
      detectAction = new Action('detect_z_fighting', {
        name: 'Detect Z-Fighting',
        description: 'Find overlapping faces',
        icon: 'search',
        click: function() {
          detectZFighting(false);
        }
      });
      
      // Auto fix action
      fixAction = new Action('fix_z_fighting', {
        name: 'Fix Z-Fighting',
        description: 'Automatically fix z-fighting with inflate',
        icon: 'build',
        click: function() {
          detectZFighting(true);
        }
      });
      
      // Add to menu
      MenuBar.addAction(detectAction, 'tools');
      MenuBar.addAction(fixAction, 'tools');
      MenuBar.addAction(settingsAction, 'tools');
    },
    
    onunload() {
      detectAction.delete();
      fixAction.delete();
      settingsAction.delete();
    }
  });
  
  function showSettings() {
    let dialog = new Dialog({
      id: 'z_fighting_settings_dialog',
      title: 'Z-Fighting Fixer Settings',
      width: 500,
      form: {
        inflateAmount: {
          label: 'Inflate Amount',
          type: 'number',
          value: settings.inflateAmount,
          min: 0.001,
          max: 1,
          step: 0.001,
          description: 'How much to inflate cubes (higher = more separation)'
        },
        tolerance: {
          label: 'Detection Tolerance',
          type: 'number',
          value: settings.tolerance,
          min: 0.0001,
          max: 0.1,
          step: 0.0001,
          description: 'Distance threshold for detecting overlaps (lower = stricter)'
        },
        autoRecheck: {
          label: 'Auto Recheck After Fix',
          type: 'checkbox',
          value: settings.autoRecheck,
          description: 'Automatically detect again after fixing'
        }
      },
      onConfirm: function(formData) {
        settings.inflateAmount = parseFloat(formData.inflateAmount);
        settings.tolerance = parseFloat(formData.tolerance);
        settings.autoRecheck = formData.autoRecheck;
        
        Blockbench.showQuickMessage('Settings saved!', 2000);
        dialog.hide();
      }
    });
    
    dialog.show();
  }
  
  function detectZFighting(autoFix) {
    // Collect all cubes
    let cubes = [];
    
    function collectCubes(elements) {
      elements.forEach(element => {
        if (element instanceof Cube) {
          cubes.push(element);
        }
        if (element.children && element.children.length > 0) {
          collectCubes(element.children);
        }
      });
    }
    
    collectCubes(Outliner.elements);
    
    if (cubes.length === 0) {
      Blockbench.showQuickMessage('No cubes found!', 2000);
      return;
    }
    
    let conflicts = [];
    
    // Check all cubes
    for (let i = 0; i < cubes.length; i++) {
      for (let j = i + 1; j < cubes.length; j++) {
        let cube1 = cubes[i];
        let cube2 = cubes[j];
        
        let faces = checkFaceOverlap(cube1, cube2, settings.tolerance);
        
        if (faces.length > 0) {
          conflicts.push({
            cube1: cube1,
            cube2: cube2,
            faces: faces,
            cube1Name: cube1.name || `Cube ${i}`,
            cube2Name: cube2.name || `Cube ${j}`
          });
        }
      }
    }
    
    // Auto fix or show results
    if (autoFix) {
      if (conflicts.length === 0) {
        Blockbench.showMessageBox({
          title: 'Z-Fighting Fix',
          icon: 'check_circle',
          message: 'No z-fighting issues found! ✓'
        });
        return;
      }
      
      showFixDialog(conflicts);
    } else {
      showResults(conflicts);
    }
  }
  
  function showFixDialog(conflicts) {
    let conflictList = '';
    conflicts.forEach((conflict, index) => {
      conflictList += `#${index + 1}: ${conflict.cube1Name} ↔ ${conflict.cube2Name} (${conflict.faces.join(', ')})\n`;
    });
    
    let dialog = new Dialog({
      id: 'z_fighting_fix_dialog',
      title: 'Fix Z-Fighting Issues',
      width: 550,
      lines: [
        `<div style="padding: 15px; background: #2a2a2a; border-radius: 5px; margin-bottom: 15px;">
          <h3 style="color: #ff9800; margin-top: 0;">⚠️ Found ${conflicts.length} Z-Fighting Issue(s)</h3>
          <pre style="color: #ccc; font-size: 12px; max-height: 200px; overflow-y: auto; background: #1e1e1e; padding: 10px; border-radius: 3px;">${conflictList}</pre>
        </div>
        <div style="padding: 10px; background: #1e3a1e; border-radius: 5px; border-left: 3px solid #4caf50;">
          <strong style="color: #4caf50;">Fix Method:</strong> Apply inflate to conflicting cubes<br>
          <strong style="color: #4caf50;">Inflate Amount:</strong> ${settings.inflateAmount}
        </div>`
      ],
      form: {
        fixMethod: {
          label: 'Fix Method',
          type: 'select',
          value: 'inflate_second',
          options: {
            inflate_second: 'Inflate second cube only',
            inflate_both: 'Inflate both cubes',
            inflate_all: 'Inflate all conflicting cubes'
          }
        },
        customInflate: {
          label: 'Override Inflate Amount (optional)',
          type: 'number',
          value: settings.inflateAmount,
          min: 0.001,
          max: 1,
          step: 0.001
        }
      },
      onConfirm: function(formData) {
        let inflateToUse = formData.customInflate || settings.inflateAmount;
        fixConflicts(conflicts, formData.fixMethod, inflateToUse);
        dialog.hide();
      }
    });
    
    dialog.show();
  }
  
  function fixConflicts(conflicts, method, inflateAmount) {
    let cubesToFix = new Set();
    
    conflicts.forEach((conflict) => {
      if (method === 'inflate_second') {
        cubesToFix.add(conflict.cube2);
      } else if (method === 'inflate_both') {
        cubesToFix.add(conflict.cube1);
        cubesToFix.add(conflict.cube2);
      } else if (method === 'inflate_all') {
        cubesToFix.add(conflict.cube1);
        cubesToFix.add(conflict.cube2);
      }
    });
    
    let cubesArray = Array.from(cubesToFix);
    Undo.initEdit({elements: cubesArray});
    
    let fixedCount = 0;
    
    cubesArray.forEach((cube) => {
      let oldInflate = cube.inflate || 0;
      
      if (cube.inflate === undefined || cube.inflate === 0) {
        cube.inflate = inflateAmount;
      } else {
        cube.inflate += inflateAmount;
      }
      
      console.log(`${cube.name}: inflate ${oldInflate} → ${cube.inflate}`);
      fixedCount++;
    });
    
    updateView();
    Undo.finishEdit('Fixed Z-Fighting');
    
    Blockbench.showQuickMessage(`✓ Fixed ${fixedCount} cube(s) with inflate!`, 3000);
    
    // Auto recheck if enabled
    if (settings.autoRecheck) {
      setTimeout(() => {
        console.log('Auto rechecking...');
        detectZFighting(false);
      }, 500);
    }
  }
  
  function updateView() {
    Canvas.updateAll();
    if (typeof updateSelection === 'function') {
      updateSelection();
    }
  }
  
  function checkFaceOverlap(cube1, cube2, tolerance) {
    let overlappingFaces = [];
    
    let box1 = {
      minX: Math.min(cube1.from[0], cube1.to[0]),
      maxX: Math.max(cube1.from[0], cube1.to[0]),
      minY: Math.min(cube1.from[1], cube1.to[1]),
      maxY: Math.max(cube1.from[1], cube1.to[1]),
      minZ: Math.min(cube1.from[2], cube1.to[2]),
      maxZ: Math.max(cube1.from[2], cube1.to[2])
    };
    
    let box2 = {
      minX: Math.min(cube2.from[0], cube2.to[0]),
      maxX: Math.max(cube2.from[0], cube2.to[0]),
      minY: Math.min(cube2.from[1], cube2.to[1]),
      maxY: Math.max(cube2.from[1], cube2.to[1]),
      minZ: Math.min(cube2.from[2], cube2.to[2]),
      maxZ: Math.max(cube2.from[2], cube2.to[2])
    };
    
    // Check X axis
    if (Math.abs(box1.maxX - box2.minX) < tolerance || Math.abs(box1.minX - box2.maxX) < tolerance) {
      if (boxesOverlap2D(box1.minY, box1.maxY, box1.minZ, box1.maxZ, box2.minY, box2.maxY, box2.minZ, box2.maxZ)) {
        overlappingFaces.push('X-axis');
      }
    }
    
    // Check Y axis
    if (Math.abs(box1.maxY - box2.minY) < tolerance || Math.abs(box1.minY - box2.maxY) < tolerance) {
      if (boxesOverlap2D(box1.minX, box1.maxX, box1.minZ, box1.maxZ, box2.minX, box2.maxX, box2.minZ, box2.maxZ)) {
        overlappingFaces.push('Y-axis');
      }
    }
    
    // Check Z axis
    if (Math.abs(box1.maxZ - box2.minZ) < tolerance || Math.abs(box1.minZ - box2.maxZ) < tolerance) {
      if (boxesOverlap2D(box1.minX, box1.maxX, box1.minY, box1.maxY, box2.minX, box2.maxX, box2.minY, box2.maxY)) {
        overlappingFaces.push('Z-axis');
      }
    }
    
    return overlappingFaces;
  }
  
  function boxesOverlap2D(min1a, max1a, min1b, max1b, min2a, max2a, min2b, max2b) {
    return !(max1a < min2a || min1a > max2a || max1b < min2b || min1b > max2b);
  }
  
  function showResults(conflicts) {
    if (conflicts.length === 0) {
      new Dialog({
        id: 'z_fighting_results',
        title: 'Z-Fighting Detection Results',
        width: 500,
        lines: [
          `<div style="padding: 20px; text-align: center; background: #1e3a1e; border-radius: 5px; border: 2px solid #4caf50;">
            <h2 style="color: #4caf50; margin: 0;">✓ No Issues Found!</h2>
            <p style="color: #ccc; margin-top: 10px;">Your model has no z-fighting problems.</p>
          </div>`
        ],
        buttons: ['dialog.ok']
      }).show();
      return;
    }
    
    let reportHTML = `
      <style>
        .conflict-item {
          padding: 12px;
          margin: 8px 0;
          background: #2a2a2a;
          border-radius: 5px;
          border-left: 4px solid #ff9800;
        }
        .conflict-header {
          font-weight: bold;
          color: #ff9800;
          margin-bottom: 5px;
          font-size: 14px;
        }
        .conflict-detail {
          color: #aaa;
          font-size: 12px;
        }
        .face-list {
          color: #ffeb3b;
          font-size: 12px;
          margin-top: 3px;
        }
        .summary {
          padding: 15px;
          background: #3d1e1e;
          border-radius: 5px;
          margin-bottom: 15px;
          font-weight: bold;
          color: #ff5252;
          border: 2px solid #ff5252;
        }
        .tip {
          padding: 10px;
          background: #1e2a3d;
          border-radius: 5px;
          margin-top: 15px;
          color: #64b5f6;
          font-size: 12px;
          border-left: 3px solid #2196f3;
        }
      </style>
      <div class="summary">
        ⚠️ Found ${conflicts.length} Z-Fighting Issue(s)
      </div>
    `;
    
    conflicts.forEach((conflict, index) => {
      reportHTML += `
        <div class="conflict-item">
          <div class="conflict-header">Conflict #${index + 1}</div>
          <div class="conflict-detail">📦 ${conflict.cube1Name} ↔️ ${conflict.cube2Name}</div>
          <div class="face-list">🔍 Overlapping: ${conflict.faces.join(', ')}</div>
        </div>
      `;
    });
    
    reportHTML += `
      <div class="tip">
        💡 <strong>Tip:</strong> Use "Fix Z-Fighting" from the Tools menu to automatically fix these issues.
      </div>
    `;
    
    new Dialog({
      id: 'z_fighting_results',
      title: 'Z-Fighting Detection Report',
      width: 550,
      lines: [reportHTML],
      buttons: ['dialog.ok']
    }).show();
    
    // Log to console
    console.log('=== Z-Fighting Report ===');
    conflicts.forEach((conflict, index) => {
      console.log(`Conflict #${index + 1}:`);
      console.log(`  Cube 1: ${conflict.cube1Name}`);
      console.log(`  Cube 2: ${conflict.cube2Name}`);
      console.log(`  Overlapping: ${conflict.faces.join(', ')}`);
    });
  }
  
})();
