(function() {
  
  let detectAction, fixAction, settingsAction;
  let settings = {
    separationAmount: 0.001,
    tolerance: 0.01, // Daha büyük - sadece gerçek iç içe girmeleri yakalar
    autoRecheck: true,
    fixMethod: 'inflate' // 'separate' or 'inflate'
  };
  
  Plugin.register('z_fighting_fixer', {
    title: 'Z-Fighting Fixer',
    author: 'robotic1545',
    description: 'Detects and automatically fixes z-fighting and overlapping issues',
    icon: 'build',
    version: '2.1.0',
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
        description: 'Find overlapping faces and cubes',
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
        fixMethod: {
          label: 'Fix Method',
          type: 'select',
          value: settings.fixMethod,
          options: {
            inflate: 'Inflate Cubes (Recommended)',
            separate: 'Separate Cubes (Move Apart)'
          },
          description: 'How to fix overlapping cubes'
        },
        separationAmount: {
          label: 'Separation Amount',
          type: 'number',
          value: settings.separationAmount,
          min: 0.001,
          max: 1,
          step: 0.001,
          description: 'Distance to move cubes apart (higher = more separation)'
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
        settings.fixMethod = formData.fixMethod;
        settings.separationAmount = parseFloat(formData.separationAmount);
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
    
    // Check all cubes for overlaps
    for (let i = 0; i < cubes.length; i++) {
      for (let j = i + 1; j < cubes.length; j++) {
        let cube1 = cubes[i];
        let cube2 = cubes[j];
        
        let overlapInfo = checkCubeOverlap(cube1, cube2, settings.tolerance);
        
        if (overlapInfo.overlapping) {
          conflicts.push({
            cube1: cube1,
            cube2: cube2,
            overlapInfo: overlapInfo,
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
  
  function checkCubeOverlap(cube1, cube2, tolerance) {
    // Get bounding boxes WITH inflate applied
    let inflate1 = cube1.inflate || 0;
    let inflate2 = cube2.inflate || 0;
    
    console.log(`Checking: ${cube1.name} (inflate: ${inflate1}) vs ${cube2.name} (inflate: ${inflate2})`);
    
    let box1 = {
      minX: Math.min(cube1.from[0], cube1.to[0]) - inflate1,
      maxX: Math.max(cube1.from[0], cube1.to[0]) + inflate1,
      minY: Math.min(cube1.from[1], cube1.to[1]) - inflate1,
      maxY: Math.max(cube1.from[1], cube1.to[1]) + inflate1,
      minZ: Math.min(cube1.from[2], cube1.to[2]) - inflate1,
      maxZ: Math.max(cube1.from[2], cube1.to[2]) + inflate1
    };
    
    let box2 = {
      minX: Math.min(cube2.from[0], cube2.to[0]) - inflate2,
      maxX: Math.max(cube2.from[0], cube2.to[0]) + inflate2,
      minY: Math.min(cube2.from[1], cube2.to[1]) - inflate2,
      maxY: Math.max(cube2.from[1], cube2.to[1]) + inflate2,
      minZ: Math.min(cube2.from[2], cube2.to[2]) - inflate2,
      maxZ: Math.max(cube2.from[2], cube2.to[2]) + inflate2
    };
    
    // Check for 3D overlap (cubes inside each other) - bu hata!
    let overlapX = Math.max(0, Math.min(box1.maxX, box2.maxX) - Math.max(box1.minX, box2.minX));
    let overlapY = Math.max(0, Math.min(box1.maxY, box2.maxY) - Math.max(box1.minY, box2.minY));
    let overlapZ = Math.max(0, Math.min(box1.maxZ, box2.maxZ) - Math.max(box1.minZ, box2.minZ));
    
    console.log(`  Overlap: X=${overlapX.toFixed(3)}, Y=${overlapY.toFixed(3)}, Z=${overlapZ.toFixed(3)}, Tolerance=${tolerance}`);
    
    // Sadece gerçek 3D overlap hata sayılır - tolerance'dan FAZLA iç içe girme
    // Yan yana (touching) küpler bu testi geçemez çünkü bir eksende 0 overlap var
    let is3DOverlap = overlapX > tolerance && overlapY > tolerance && overlapZ > tolerance;
    
    console.log(`  Result: ${is3DOverlap ? 'OVERLAP!' : 'OK'}`);
    
    // Face overlaps hiç kontrol etme - yan yana küpler normal
    let faces = [];
    
    return {
      overlapping: is3DOverlap, // SADECE 3D overlap hata
      is3DOverlap: is3DOverlap,
      faces: faces,
      overlapAmount: {
        x: overlapX,
        y: overlapY,
        z: overlapZ
      }
    };
  }
  
  function boxesOverlap2D(min1a, max1a, min1b, max1b, min2a, max2a, min2b, max2b) {
    return !(max1a < min2a || min1a > max2a || max1b < min2b || min1b > max2b);
  }
  
  function showFixDialog(conflicts) {
    let conflictList = '';
    conflicts.forEach((conflict, index) => {
      let type = conflict.overlapInfo.is3DOverlap ? '3D Overlap' : 'Face Overlap';
      let details = conflict.overlapInfo.is3DOverlap 
        ? `(${conflict.overlapInfo.overlapAmount.x.toFixed(2)}×${conflict.overlapInfo.overlapAmount.y.toFixed(2)}×${conflict.overlapInfo.overlapAmount.z.toFixed(2)})`
        : `(${conflict.overlapInfo.faces.join(', ')})`;
      conflictList += `#${index + 1}: ${conflict.cube1Name} ↔ ${conflict.cube2Name}\n  Type: ${type} ${details}\n`;
    });
    
    let dialog = new Dialog({
      id: 'z_fighting_fix_dialog',
      title: 'Fix Z-Fighting & Overlaps',
      width: 550,
      lines: [
        `<div style="padding: 15px; background: #2a2a2a; border-radius: 5px; margin-bottom: 15px;">
          <h3 style="color: #ff9800; margin-top: 0;">⚠️ Found ${conflicts.length} Issue(s)</h3>
          <pre style="color: #ccc; font-size: 12px; max-height: 200px; overflow-y: auto; background: #1e1e1e; padding: 10px; border-radius: 3px;">${conflictList}</pre>
        </div>
        <div style="padding: 10px; background: #1e3a1e; border-radius: 5px; border-left: 3px solid #4caf50;">
          <strong style="color: #4caf50;">Fix Method:</strong> ${settings.fixMethod === 'separate' ? 'Separate cubes by moving them apart' : 'Inflate cubes to create separation'}<br>
          <strong style="color: #4caf50;">Amount:</strong> ${settings.separationAmount}
        </div>`
      ],
      form: {
        fixMethod: {
          label: 'Fix Method',
          type: 'select',
          value: settings.fixMethod,
          options: {
            inflate: 'Inflate Cubes (Recommended)',
            separate: 'Separate Cubes'
          }
        },
        customAmount: {
          label: 'Override Amount (optional)',
          type: 'number',
          value: settings.separationAmount,
          min: 0.001,
          max: 1,
          step: 0.001
        }
      },
      onConfirm: function(formData) {
        let method = formData.fixMethod;
        let amount = formData.customAmount || settings.separationAmount;
        fixConflicts(conflicts, method, amount);
        dialog.hide();
      }
    });
    
    dialog.show();
  }
  
  function fixConflicts(conflicts, method, amount) {
    let cubesToFix = new Set();
    
    conflicts.forEach((conflict) => {
      cubesToFix.add(conflict.cube2);
    });
    
    let cubesArray = Array.from(cubesToFix);
    Undo.initEdit({elements: cubesArray});
    
    let fixedCount = 0;
    
    if (method === 'inflate') {
      // Inflate method (old way)
      cubesArray.forEach((cube) => {
        let oldInflate = cube.inflate || 0;
        
        if (cube.inflate === undefined || cube.inflate === 0) {
          cube.inflate = amount;
        } else {
          cube.inflate += amount;
        }
        
        console.log(`${cube.name}: inflate ${oldInflate} → ${cube.inflate}`);
        fixedCount++;
      });
    } else {
      // Separate method (move cubes apart)
      conflicts.forEach((conflict) => {
        let cube1 = conflict.cube1;
        let cube2 = conflict.cube2;
        let overlapInfo = conflict.overlapInfo;
        
        if (overlapInfo.is3DOverlap) {
          // 3D overlap - separate along the axis with most overlap
          let maxOverlap = Math.max(overlapInfo.overlapAmount.x, overlapInfo.overlapAmount.y, overlapInfo.overlapAmount.z);
          
          if (maxOverlap === overlapInfo.overlapAmount.x) {
            // Separate on X axis
            let direction = cube2.from[0] > cube1.from[0] ? 1 : -1;
            cube2.from[0] += direction * (overlapInfo.overlapAmount.x + amount);
            cube2.to[0] += direction * (overlapInfo.overlapAmount.x + amount);
          } else if (maxOverlap === overlapInfo.overlapAmount.y) {
            // Separate on Y axis
            let direction = cube2.from[1] > cube1.from[1] ? 1 : -1;
            cube2.from[1] += direction * (overlapInfo.overlapAmount.y + amount);
            cube2.to[1] += direction * (overlapInfo.overlapAmount.y + amount);
          } else {
            // Separate on Z axis
            let direction = cube2.from[2] > cube1.from[2] ? 1 : -1;
            cube2.from[2] += direction * (overlapInfo.overlapAmount.z + amount);
            cube2.to[2] += direction * (overlapInfo.overlapAmount.z + amount);
          }
          fixedCount++;
        } else if (overlapInfo.faces.length > 0) {
          // Face overlap - use inflate for now
          if (cube2.inflate === undefined || cube2.inflate === 0) {
            cube2.inflate = amount;
          } else {
            cube2.inflate += amount;
          }
          fixedCount++;
        }
      });
    }
    
    updateView();
    Undo.finishEdit('Fixed Z-Fighting');
    
    Blockbench.showQuickMessage(`✓ Fixed ${fixedCount} issue(s)!`, 3000);
    
    // Auto recheck if enabled
    if (settings.autoRecheck) {
      setTimeout(() => {
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
  
  function showResults(conflicts) {
    if (conflicts.length === 0) {
      new Dialog({
        id: 'z_fighting_results',
        title: 'Z-Fighting Detection Results',
        width: 500,
        lines: [
          `<div style="padding: 20px; text-align: center; background: #1e3a1e; border-radius: 5px; border: 2px solid #4caf50;">
            <h2 style="color: #4caf50; margin: 0;">✓ No Issues Found!</h2>
            <p style="color: #ccc; margin-top: 10px;">Your model has no z-fighting or overlap problems.</p>
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
        .conflict-type {
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
        ⚠️ Found ${conflicts.length} Issue(s)
      </div>
    `;
    
    conflicts.forEach((conflict, index) => {
      let type = conflict.overlapInfo.is3DOverlap ? '🔴 3D Overlap (Cubes Inside Each Other)' : '🟡 Face Overlap (Z-Fighting)';
      let details = conflict.overlapInfo.is3DOverlap 
        ? `Size: ${conflict.overlapInfo.overlapAmount.x.toFixed(2)}×${conflict.overlapInfo.overlapAmount.y.toFixed(2)}×${conflict.overlapInfo.overlapAmount.z.toFixed(2)}`
        : `Faces: ${conflict.overlapInfo.faces.join(', ')}`;
      
      reportHTML += `
        <div class="conflict-item">
          <div class="conflict-header">Issue #${index + 1}</div>
          <div class="conflict-detail">📦 ${conflict.cube1Name} ↔️ ${conflict.cube2Name}</div>
          <div class="conflict-type">${type}</div>
          <div class="conflict-type">${details}</div>
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
      title: 'Z-Fighting & Overlap Report',
      width: 550,
      lines: [reportHTML],
      buttons: ['dialog.ok']
    }).show();
  }
  
})();
