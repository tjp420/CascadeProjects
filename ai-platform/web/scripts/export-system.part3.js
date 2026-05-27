      })),
      performance: {
        rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 to 5.0
        completedTasks: Math.floor(Math.random() * 50) + 10,
        ongoingTasks: Math.floor(Math.random() * 10) + 1,
        attendance: Math.floor(Math.random() * 10) + 90, // 90-100%
        productivity: Math.floor(Math.random() * 20) + 80, // 80-100%
      },
      training: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, index) => ({
        id: `training_${index + 1}`,
        name: `Training Course ${index + 1}`,
        status: ['completed', 'in-progress', 'upcoming'][Math.floor(Math.random() * 3)],
        completionDate: new Date(
          now - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)
        ).toISOString(),
      })),
    };
  }

  function showMemberSummary(memberData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'member-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">👥 Team Member Added Successfully</h3>
                <button onclick="closeMemberSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary-color), var(--success-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img src="${memberData.avatar}" alt="${memberData.fullName}" style="width: 60px; height: 60px; border-radius: 50%;">
                    <div>
                        <h4 style="margin: 0 0 0.5rem 0;">${memberData.fullName}</h4>
                        <p style="margin: 0; opacity: 0.9;">${memberData.title} • ${memberData.department}</p>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Member Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Email</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.email}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Phone</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.phone || 'Not provided'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Role</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Employment Type</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.employmentType.replace('-', ' ').charAt(0).toUpperCase() + memberData.employmentType.replace('-', ' ').slice(1)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Start Date</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(memberData.startDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Status</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.status.charAt(0).toUpperCase() + memberData.status.slice(1)}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Performance Overview</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Rating</div>
                        <div style="color: var(--text-primary); font-weight: 500;">⭐ ${memberData.performance.rating}/5.0</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Completed Tasks</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.performance.completedTasks}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Ongoing Tasks</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.performance.ongoingTasks}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Attendance</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${memberData.performance.attendance}%</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Current Projects (${memberData.projects.length})</h4>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${memberData.projects
                      .map(
                        (project) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; background: var(--card-bg); border-radius: 4px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500; font-size: 0.9rem;">${project.name}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Role: ${project.role}</div>
                            </div>
                            <span style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: ${project.status === 'active' ? 'var(--success-color)' : project.status === 'completed' ? 'var(--primary-color)' : 'var(--warning-color)'}; color: white; border-radius: 4px;">
                                ${project.status}
                            </span>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeMemberSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeMemberSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeMemberSummary() {
    const modal = document.getElementById('member-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function addMemberToCurrentData(memberData) {
    // This would normally update the current team data
    // For now, we'll just store it in localStorage for demonstration
    const currentMembers = JSON.parse(localStorage.getItem('teamMembers') || '[]');
    currentMembers.push(memberData);
    localStorage.setItem('teamMembers', JSON.stringify(currentMembers));
  }

  // Department Management Function
  function createDepartment() {
    console.log('Creating new department...');

    // Create department modal
    const deptModal = document.createElement('div');
    deptModal.id = 'create-department-modal';
    deptModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    deptModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🏢 Create Department</h3>
                <button onclick="closeCreateDepartment()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Create a new department to organize your team structure and manage departmental resources.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Department Name</label>
                        <input type="text" id="dept-name" placeholder="Enter department name" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Department Code</label>
                        <input type="text" id="dept-code" placeholder="Enter department code (e.g., ENG, MKT)" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Description</label>
                        <textarea id="dept-description" placeholder="Describe the department's purpose and responsibilities" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); min-height: 80px; resize: vertical;"></textarea>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Department Head</label>
                        <select id="dept-head" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="">Select Department Head</option>
                            <option value="john-doe">John Doe</option>
                            <option value="jane-smith">Jane Smith</option>
                            <option value="bob-johnson">Bob Johnson</option>
                            <option value="alice-brown">Alice Brown</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Parent Department</label>
                        <select id="dept-parent" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="">None (Top Level)</option>
                            <option value="operations">Operations</option>
                            <option value="technology">Technology</option>
                            <option value="business">Business</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Budget Allocation</label>
                        <input type="number" id="dept-budget" placeholder="Enter annual budget" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Department Type</label>
                        <select id="dept-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="operational">Operational</option>
                            <option value="support">Support</option>
                            <option value="strategic">Strategic</option>
                            <option value="administrative">Administrative</option>
                            <option value="technical">Technical</option>
                            <option value="creative">Creative</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Location</label>
                        <input type="text" id="dept-location" placeholder="Enter office location" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Key Responsibilities</label>
                        <textarea id="dept-responsibilities" placeholder="List key responsibilities and functions" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); min-height: 80px; resize: vertical;"></textarea>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeCreateDepartment()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="createDepartment()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-building"></i> Create Department
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(deptModal);

    // Add click outside to close
    deptModal.addEventListener('click', (e) => {
      if (e.target === deptModal) {
        closeCreateDepartment();
      }
    });

    // Show modal
    setTimeout(() => {
      deptModal.style.display = 'flex';
    }, 100);
  }

  function closeCreateDepartment() {
    const modal = document.getElementById('create-department-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function createDepartment() {
    const deptName = document.getElementById('dept-name').value;
    const deptCode = document.getElementById('dept-code').value;
    const deptDescription = document.getElementById('dept-description').value;
    const deptHead = document.getElementById('dept-head').value;
    const deptParent = document.getElementById('dept-parent').value;
    const deptBudget = document.getElementById('dept-budget').value;
    const deptType = document.getElementById('dept-type').value;
    const deptLocation = document.getElementById('dept-location').value;
    const deptResponsibilities = document.getElementById('dept-responsibilities').value;

    // Validate required fields
    if (!deptName || !deptCode || !deptDescription) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    if (!/^[A-Z]{2,4}$/.test(deptCode)) {
      showNotification('Department code must be 2-4 uppercase letters', 'error');
      return;
    }

    closeCreateDepartment();

    // Create department progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'create-dept-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Creating Department...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Setting up department "${deptName}"...</span>
                    <span id="create-dept-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="create-dept-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="create-dept-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing department creation...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate department creation process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification(`Department "${deptName}" created successfully!`, 'success');

          // Generate department data
          const deptData = generateDepartmentData({
            name: deptName,
            code: deptCode,
            description: deptDescription,
            head: deptHead,
            parent: deptParent,
            budget: deptBudget,
            type: deptType,
            location: deptLocation,
            responsibilities: deptResponsibilities,
          });

          // Show department summary
          showDepartmentSummary(deptData);

          // Add department to current data
          addDepartmentToCurrentData(deptData);
        }, 500);
      }

      document.getElementById('create-dept-bar').style.width = progress + '%';
      document.getElementById('create-dept-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('create-dept-status');
      if (progress < 20) {
        statusElement.textContent = 'Initializing department creation...';
      } else if (progress < 40) {
        statusElement.textContent = 'Setting up department structure...';
      } else if (progress < 60) {
        statusElement.textContent = 'Assigning department head...';
      } else if (progress < 80) {
        statusElement.textContent = 'Creating department resources...';
      } else {
        statusElement.textContent = 'Finalizing department setup...';
      }
    }, 350);
  }

  function generateDepartmentData(deptConfig) {
    const now = new Date();
    const deptId = `dept_${now.getTime()}`;

    return {
      id: deptId,
      name: deptConfig.name,
      code: deptConfig.code,
      description: deptConfig.description,
      head: deptConfig.head,
      parent: deptConfig.parent,
      budget: parseFloat(deptConfig.budget) || 0,
      type: deptConfig.type,
      location: deptConfig.location,
      responsibilities: deptConfig.responsibilities,
      status: 'active',
      created: now.toISOString(),
      employees: Math.floor(Math.random() * 20) + 5,
      teams: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, index) => ({
        id: `team_${index + 1}`,
        name: `Team ${index + 1}`,
        lead: ['John Doe', 'Jane Smith', 'Bob Johnson'][Math.floor(Math.random() * 3)],
        members: Math.floor(Math.random() * 8) + 3,
        projects: Math.floor(Math.random() * 5) + 1,
      })),
      metrics: {
        budgetUtilization: Math.floor(Math.random() * 30) + 70, // 70-100%
        productivity: Math.floor(Math.random() * 20) + 80, // 80-100%
        satisfaction: Math.floor(Math.random() * 15) + 85, // 85-100%
        turnover: Math.floor(Math.random() * 10) + 5, // 5-15%
      },
      resources: {
        meetingRooms: Math.floor(Math.random() * 5) + 2,
        equipment: Math.floor(Math.random() * 20) + 10,
        software: Math.floor(Math.random() * 15) + 5,
        licenses: Math.floor(Math.random() * 10) + 3,
      },
    };
  }

  function showDepartmentSummary(deptData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'dept-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">🏢 Department Created Successfully</h3>
                <button onclick="closeDepartmentSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary-color), var(--success-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">${deptData.name}</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${deptData.code}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Department Code</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${deptData.type.charAt(0).toUpperCase() + deptData.type.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Type</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${deptData.employees}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Employees</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${deptData.teams.length}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Teams</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Department Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Description</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.description}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Department Head</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.head ? deptData.head.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Not assigned'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Location</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.location || 'Not specified'}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Status</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.status.charAt(0).toUpperCase() + deptData.status.slice(1)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Created</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(deptData.created).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Budget</div>
                        <div style="color: var(--text-primary); font-weight: 500;">$${deptData.budget.toLocaleString()}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Performance Metrics</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Budget Utilization</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.metrics.budgetUtilization}%</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Productivity</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.metrics.productivity}%</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Satisfaction</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.metrics.satisfaction}%</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Turnover Rate</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${deptData.metrics.turnover}%</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Teams (${deptData.teams.length})</h4>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${deptData.teams
                      .map(
                        (team) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-bottom: 0.5rem; background: var(--card-bg); border-radius: 4px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500; font-size: 0.9rem;">${team.name}</div>
                                <div style="color: var(--text-secondary); font-size: 0.8rem;">Lead: ${team.lead} • ${team.members} members</div>
                            </div>
                            <span style="font-size: 0.8rem; padding: 0.25rem 0.5rem; background: var(--primary-color); color: white; border-radius: 4px;">
                                ${team.projects} projects
                            </span>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeDepartmentSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeDepartmentSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeDepartmentSummary() {
    const modal = document.getElementById('dept-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function addDepartmentToCurrentData(deptData) {
    // This would normally update the current department data
    // For now, we'll just store it in localStorage for demonstration
    const currentDepartments = JSON.parse(localStorage.getItem('departments') || '[]');
    currentDepartments.push(deptData);
    localStorage.setItem('departments', JSON.stringify(currentDepartments));
  }

  // Team Report Export Function
  function exportTeamReport() {
    console.log('Exporting team report...');

    // Create export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'export-team-report-modal';
    exportModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📊 Export Team Report</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Export comprehensive team analytics and performance reports.</p>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Report Type</label>
                        <select id="team-report-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="overview">Team Overview</option>
                            <option value="performance">Performance Analysis</option>
                            <option value="department">Department Breakdown</option>
                            <option value="individual">Individual Reports</option>
                            <option value="comprehensive">Comprehensive Report</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Export Format</label>
                        <select id="team-report-format" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="pdf">PDF Document</option>
                            <option value="excel">Excel Spreadsheet</option>
                            <option value="powerpoint">PowerPoint Presentation</option>
                            <option value="json">JSON Data</option>
                            <option value="csv">CSV File</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Time Period</label>
                        <select id="team-report-period" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);">
                            <option value="current">Current Period</option>
                            <option value="last30">Last 30 Days</option>
                            <option value="last90">Last 90 Days</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="color: var(--text-primary); font-weight: 500; margin-bottom: 0.5rem;">Include Options</label>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-performance" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Performance metrics</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-departments" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Department breakdown</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-individuals" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Individual member data</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-charts" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Charts and graphs</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="include-recommendations" checked style="cursor: pointer;">
                                <span style="color: var(--text-secondary);">Recommendations</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeExportTeamReport()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="generateTeamReportExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> Export Report
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeExportTeamReport();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeExportTeamReport() {
    const modal = document.getElementById('export-team-report-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function generateTeamReportExport() {
    const reportType = document.getElementById('team-report-type').value;
    const reportFormat = document.getElementById('team-report-format').value;
    const reportPeriod = document.getElementById('team-report-period').value;
    const includePerformance = document.getElementById('include-performance')?.checked ?? true;
    const includeDepartments = document.getElementById('include-departments')?.checked ?? true;
    const includeIndividuals = document.getElementById('include-individuals')?.checked ?? true;
    const includeCharts = document.getElementById('include-charts')?.checked ?? true;
    const includeRecommendations =
      document.getElementById('include-recommendations')?.checked ?? true;

    closeExportTeamReport();

    // Create export progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'export-team-progress-modal';
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">Exporting Team Report...</h3>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-secondary);">Generating ${reportFormat.toUpperCase()} report...</span>
                    <span id="export-team-progress" style="color: var(--text-primary); font-weight: 500;">0%</span>
                </div>
                <div style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden;">
                    <div id="export-team-bar" style="height: 100%; width: 0%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            <div id="export-team-status" style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
                Initializing export process...
            </div>
        </div>
    `;

    document.body.appendChild(progressModal);

    // Simulate export process
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          showNotification(
            `Team report exported successfully as ${reportFormat.toUpperCase()}!`,
            'success'
          );

          // Generate and download team report
          const teamReportData = generateTeamReportData({
            type: reportType,
            format: reportFormat,
            period: reportPeriod,
            includePerformance,
            includeDepartments,
            includeIndividuals,
            includeCharts,
            includeRecommendations,
          });

          downloadTeamReport(teamReportData, reportFormat);

          // Show export summary
          showTeamReportSummary(teamReportData);
        }, 500);
      }

      document.getElementById('export-team-bar').style.width = progress + '%';
      document.getElementById('export-team-progress').textContent = Math.round(progress) + '%';

      // Update status messages
      const statusElement = document.getElementById('export-team-status');
      if (progress < 20) {
        statusElement.textContent = 'Initializing export process...';
      } else if (progress < 40) {
        statusElement.textContent = 'Collecting team data...';
      } else if (progress < 60) {
        statusElement.textContent = 'Analyzing performance metrics...';
      } else if (progress < 80) {
        statusElement.textContent = 'Generating charts and visualizations...';
      } else {
        statusElement.textContent = 'Finalizing report...';
      }
    }, 350);
  }

  function generateTeamReportData(reportConfig) {
    const teamMembers = JSON.parse(localStorage.getItem('teamMembers') || '[]');
    const departments = JSON.parse(localStorage.getItem('departments') || '[]');

    return {
      reportId: `team_report_${new Date().getTime()}`,
      type: reportConfig.type,
      format: reportConfig.format,
      period: reportConfig.period,
      generated: new Date().toISOString(),
      teamMembers: teamMembers,
      departments: departments,
      options: {
        includePerformance: reportConfig.includePerformance,
        includeDepartments: reportConfig.includeDepartments,
        includeIndividuals: reportConfig.includeIndividuals,
        includeCharts: reportConfig.includeCharts,
        includeRecommendations: reportConfig.includeRecommendations,
      },
      content: generateTeamReportContent(reportConfig),
      summary: {
        totalMembers: teamMembers.length,
        totalDepartments: departments.length,
        averagePerformance:
          teamMembers.reduce((acc, member) => acc + parseFloat(member.performance.rating), 0) /
            teamMembers.length || 0,
        totalBudget: departments.reduce((acc, dept) => acc + dept.budget, 0),
      },
    };
  }

  function generateTeamReportContent(reportConfig) {
    const teamMembers = JSON.parse(localStorage.getItem('teamMembers') || '[]');
    const departments = JSON.parse(localStorage.getItem('departments') || '[]');

    switch (reportConfig.type) {
      case 'overview':
        return generateTeamOverviewContent(teamMembers, departments, reportConfig);
      case 'performance':
        return generateTeamPerformanceContent(teamMembers, departments, reportConfig);
      case 'department':
        return generateTeamDepartmentContent(teamMembers, departments, reportConfig);
      case 'individual':
        return generateTeamIndividualContent(teamMembers, departments, reportConfig);
      case 'comprehensive':
        return generateTeamComprehensiveContent(teamMembers, departments, reportConfig);
      default:
        return generateTeamOverviewContent(teamMembers, departments, reportConfig);
    }
  }

  function generateTeamOverviewContent(teamMembers, departments, reportConfig) {
    return `
TEAM OVERVIEW REPORT
====================

Generated: ${new Date().toLocaleString()}
Report Type: Team Overview
Export Format: ${reportConfig.format.toUpperCase()}
Export Period: ${reportConfig.period}

EXECUTIVE SUMMARY
-----------------
Total Team Members: ${teamMembers.length}
Total Departments: ${departments.length}
Active Members: ${teamMembers.filter((m) => m.status === 'active').length}
Average Performance Rating: ${(teamMembers.reduce((acc, m) => acc + parseFloat(m.performance.rating), 0) / teamMembers.length || 0).toFixed(2)}/5.0

${
  reportConfig.includeDepartments
    ? `
DEPARTMENT BREAKDOWN
--------------------
${departments
  .map(
    (dept, index) => `
${index + 1}. ${dept.name} (${dept.code})
   Head: ${dept.head || 'Not assigned'}
   Employees: ${dept.employees}
   Budget: $${dept.budget.toLocaleString()}
   Teams: ${dept.teams.length}
   Type: ${dept.type}
   Status: ${dept.status}
   Location: ${dept.location || 'Not specified'}
`
  )
  .join('\n')}
`
    : ''
}

${
  reportConfig.includeIndividuals
    ? `
TEAM MEMBER OVERVIEW
--------------------
${teamMembers
  .map(
    (member, index) => `
${index + 1}. ${member.fullName}
   Email: ${member.email}
   Title: ${member.title}
   Department: ${member.department}
   Role: ${member.role}
   Performance: ${member.performance.rating}/5.0
   Status: ${member.status}
   Start Date: ${new Date(member.startDate).toLocaleDateString()}
   Projects: ${member.projects.length}
`
  )
  .join('\n')}
`
    : ''
}

${
  reportConfig.includePerformance
    ? `
PERFORMANCE METRICS
------------------
Overall Team Performance: ${(teamMembers.reduce((acc, m) => acc + parseFloat(m.performance.rating), 0) / teamMembers.length || 0).toFixed(2)}/5.0
Average Attendance: ${(teamMembers.reduce((acc, m) => acc + m.performance.attendance, 0) / teamMembers.length || 0).toFixed(1)}%
Average Productivity: ${(teamMembers.reduce((acc, m) => acc + m.performance.productivity, 0) / teamMembers.length || 0).toFixed(1)}%
Total Completed Tasks: ${teamMembers.reduce((acc, m) => acc + m.performance.completedTasks, 0)}
Ongoing Tasks: ${teamMembers.reduce((acc, m) => acc + m.performance.ongoingTasks, 0)}

Department Performance:
${departments
  .map(
    (dept) => `
${dept.name}: ${dept.metrics.productivity}% productivity, ${dept.metrics.satisfaction}% satisfaction, ${dept.metrics.turnover}% turnover
`
  )
  .join('')}
`
    : ''
}

${
  reportConfig.includeCharts
    ? `
CHART DATA
----------
[TEAM COMPOSITION CHART]
Total Members: ${teamMembers.length}
By Department: ${departments.map((dept) => `${dept.name}: ${dept.employees}`).join(', ')}

[PERFORMANCE DISTRIBUTION]
Excellent (4.5-5.0): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 4.5).length}
Good (3.5-4.4): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 3.5 && parseFloat(m.performance.rating) < 4.5).length}
Average (2.5-3.4): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 2.5 && parseFloat(m.performance.rating) < 3.5).length}
Below Average (<2.5): ${teamMembers.filter((m) => parseFloat(m.performance.rating) < 2.5).length}

[DEPARTMENT BUDGET ALLOCATION]
${departments.map((dept) => `${dept.name}: $${dept.budget.toLocaleString()}`).join(', ')}
`
    : ''
}

${
  reportConfig.includeRecommendations
    ? `
RECOMMENDATIONS
---------------
1. Focus on improving team member engagement and satisfaction
2. Address performance gaps through targeted training and development
3. Optimize department resource allocation based on performance metrics
4. Implement regular performance reviews and feedback sessions
5. Enhance cross-department collaboration and communication
6. Monitor and address turnover rates in underperforming departments
7. Invest in employee development and career progression programs
8. Regularly assess and adjust department budgets based on performance
`
    : ''
}

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateTeamPerformanceContent(teamMembers, departments, reportConfig) {
    return `
TEAM PERFORMANCE ANALYSIS REPORT
=================================

Generated: ${new Date().toLocaleString()}
Report Type: Performance Analysis
Export Format: ${reportConfig.format.toUpperCase()}
Export Period: ${reportConfig.period}

PERFORMANCE OVERVIEW
--------------------
Overall Team Rating: ${(teamMembers.reduce((acc, m) => acc + parseFloat(m.performance.rating), 0) / teamMembers.length || 0).toFixed(2)}/5.0
Top Performers: ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 4.5).length}/${teamMembers.length}
Needs Improvement: ${teamMembers.filter((m) => parseFloat(m.performance.rating) < 3.0).length}/${teamMembers.length}

${
  reportConfig.includeIndividuals
    ? `
INDIVIDUAL PERFORMANCE DETAILS
------------------------------
${teamMembers
  .map(
    (member, index) => `
${index + 1}. ${member.fullName}
   Rating: ${member.performance.rating}/5.0
   Completed Tasks: ${member.performance.completedTasks}
   Ongoing Tasks: ${member.performance.ongoingTasks}
   Attendance: ${member.performance.attendance}%
   Productivity: ${member.performance.productivity}%
   Department: ${member.department}
   Role: ${member.role}
   Projects: ${member.projects.length}
   Status: ${member.status}
   
   Performance Breakdown:
   - Task Completion: Excellent (${member.performance.completedTasks} tasks completed)
   - Attendance: ${member.performance.attendance >= 95 ? 'Excellent' : member.performance.attendance >= 90 ? 'Good' : 'Needs Improvement'}
   - Productivity: ${member.performance.productivity >= 90 ? 'Excellent' : member.performance.productivity >= 80 ? 'Good' : 'Needs Improvement'}
   
   ${
     member.projects.length > 0
       ? `Current Projects:
${member.projects.map((project) => `  - ${project.name} (${project.role}, ${project.status})`).join('\n')}`
       : 'No active projects'
   }
`
  )
  .join('\n\n')}
`
    : ''
}

${
  reportConfig.includeDepartments
    ? `
DEPARTMENT PERFORMANCE ANALYSIS
--------------------------------
${departments
  .map(
    (dept, index) => `
DEPARTMENT ${index + 1}: ${dept.name}
============================
Budget Utilization: ${dept.metrics.budgetUtilization}%
Productivity Score: ${dept.metrics.productivity}%
Employee Satisfaction: ${dept.metrics.satisfaction}%
Turnover Rate: ${dept.metrics.turnover}%
Total Employees: ${dept.employees}
Number of Teams: ${dept.teams.length}
Annual Budget: $${dept.budget.toLocaleString()}

Performance Analysis:
- Budget Utilization: ${dept.metrics.budgetUtilization >= 90 ? 'Optimal' : dept.metrics.budgetUtilization >= 75 ? 'Good' : 'Needs Attention'}
- Productivity: ${dept.metrics.productivity >= 90 ? 'Excellent' : dept.metrics.productivity >= 80 ? 'Good' : 'Needs Improvement'}
- Satisfaction: ${dept.metrics.satisfaction >= 90 ? 'Excellent' : dept.metrics.satisfaction >= 80 ? 'Good' : 'Needs Improvement'}
- Turnover: ${dept.metrics.turnover <= 10 ? 'Excellent' : dept.metrics.turnover <= 15 ? 'Good' : 'Needs Attention'}

Team Structure:
${dept.teams.map((team) => `  - ${team.name}: ${team.members} members, ${team.projects} projects, Lead: ${team.lead}`).join('\n')}
`
  )
  .join('\n\n')}
`
    : ''
}

${
  reportConfig.includeCharts
    ? `
PERFORMANCE VISUALIZATION DATA
----------------------------
[RATING DISTRIBUTION]
5.0 Stars: ${teamMembers.filter((m) => m.performance.rating == '5.0').length}
4.5-4.9 Stars: ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 4.5 && m.performance.rating < '5.0').length}
4.0-4.4 Stars: ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 4.0 && parseFloat(m.performance.rating) < 4.5).length}
3.5-3.9 Stars: ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 3.5 && parseFloat(m.performance.rating) < 4.0).length}
3.0-3.4 Stars: ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 3.0 && parseFloat(m.performance.rating) < 3.5).length}
Below 3.0: ${teamMembers.filter((m) => parseFloat(m.performance.rating) < 3.0).length}

[DEPARTMENT PERFORMANCE COMPARISON]
${departments.map((dept) => `${dept.name}: ${dept.metrics.productivity}% productivity, ${dept.metrics.satisfaction}% satisfaction`).join('\n')}

[TASK COMPLETION RATES]
${teamMembers.map((member) => `${member.fullName}: ${member.performance.completedTasks} completed, ${member.performance.ongoingTasks} ongoing`).join('\n')}
`
    : ''
}

${
  reportConfig.includeRecommendations
    ? `
PERFORMANCE IMPROVEMENT RECOMMENDATIONS
---------------------------------------
FOR HIGH PERFORMERS:
1. Recognize and reward exceptional performance
2. Consider for leadership and mentorship roles
3. Provide opportunities for advanced training
4. Involve in strategic decision-making processes
5. Offer career advancement opportunities

FOR AVERAGE PERFORMERS:
1. Identify specific areas for improvement
2. Provide targeted training and development
3. Set clear performance goals and expectations
4. Regular feedback and coaching sessions
5. Monitor progress and provide support

FOR UNDERPERFORMERS:
1. Conduct performance improvement plans
2. Intensive training and skill development
3. Closer supervision and mentoring
4. Regular performance reviews
5. Consider role reassignment if necessary

DEPARTMENT-SPECIFIC RECOMMENDATIONS:
${departments
  .map(
    (dept) => `
${dept.name}:
${dept.metrics.productivity < 80 ? '- Improve productivity through process optimization and training' : ''}
${dept.metrics.satisfaction < 80 ? '- Address employee satisfaction through engagement initiatives' : ''}
${dept.metrics.turnover > 15 ? '- Reduce turnover through better retention strategies' : ''}
${dept.metrics.budgetUtilization > 95 ? '- Optimize budget allocation and spending' : ''}
`
  )
  .join('\n')}

ORGANIZATIONAL RECOMMENDATIONS:
1. Implement regular performance review cycles
2. Establish clear performance metrics and KPIs
3. Provide ongoing training and development opportunities
4. Foster a culture of continuous improvement
5. Recognize and reward high performance
6. Address performance issues promptly and effectively
7. Monitor and track performance trends over time
8. Align individual and department goals with organizational objectives
`
    : ''
}

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateTeamDepartmentContent(teamMembers, departments, reportConfig) {
    return `
DEPARTMENT ANALYSIS REPORT
==========================

Generated: ${new Date().toLocaleString()}
Report Type: Department Breakdown
Export Format: ${reportConfig.format.toUpperCase()}
Export Period: ${reportConfig.period}

DEPARTMENT OVERVIEW
------------------
Total Departments: ${departments.length}
Total Employees: ${departments.reduce((acc, dept) => acc + dept.employees, 0)}
Total Budget: $${departments.reduce((acc, dept) => acc + dept.budget, 0).toLocaleString()}
Average Employees per Dept: ${(departments.reduce((acc, dept) => acc + dept.employees, 0) / departments.length || 0).toFixed(1)}

${
  reportConfig.includeDepartments
    ? `
DETAILED DEPARTMENT ANALYSIS
-----------------------------
${departments
  .map(
    (dept, index) => `
DEPARTMENT ${index + 1}: ${dept.name}
================================
Code: ${dept.code}
Type: ${dept.type}
Status: ${dept.status}
Location: ${dept.location || 'Not specified'}
Head: ${dept.head || 'Not assigned'}
Parent: ${dept.parent || 'None (Top Level)'}

RESOURCES:
Employees: ${dept.employees}
Teams: ${dept.teams.length}
Annual Budget: $${dept.budget.toLocaleString()}
Budget per Employee: $${(dept.budget / dept.employees || 0).toLocaleString()}

PERFORMANCE METRICS:
Budget Utilization: ${dept.metrics.budgetUtilization}%
Productivity: ${dept.metrics.productivity}%
Employee Satisfaction: ${dept.metrics.satisfaction}%
Turnover Rate: ${dept.metrics.turnover}%

TEAM STRUCTURE:
${dept.teams.map((team) => `  ${team.name}: ${team.members} members, ${team.projects} projects, Lead: ${team.lead}`).join('\n')}

RESOURCES ALLOCATION:
Meeting Rooms: ${dept.resources.meetingRooms}
Equipment: ${dept.resources.equipment}
Software Licenses: ${dept.resources.software}
Total Licenses: ${dept.resources.licenses}

RESPONSIBILITIES:
${dept.responsibilities || 'Not specified'}

PERFORMANCE ASSESSMENT:
- Budget Management: ${dept.metrics.budgetUtilization >= 90 && dept.metrics.budgetUtilization <= 110 ? 'Excellent' : dept.metrics.budgetUtilization > 110 ? 'Over Budget' : 'Under Utilized'}
- Productivity: ${dept.metrics.productivity >= 90 ? 'Excellent' : dept.metrics.productivity >= 80 ? 'Good' : 'Needs Improvement'}
- Employee Satisfaction: ${dept.metrics.satisfaction >= 90 ? 'Excellent' : dept.metrics.satisfaction >= 80 ? 'Good' : 'Needs Attention'}
- Staff Retention: ${dept.metrics.turnover <= 10 ? 'Excellent' : dept.metrics.turnover <= 15 ? 'Good' : 'Needs Improvement'}
`
  )
  .join('\n\n')}
`
    : ''
}

${
  reportConfig.includeIndividuals
    ? `
DEPARTMENT MEMBER DISTRIBUTION
-------------------------------
${departments
  .map(
    (dept) => `
${dept.name} Members:
${teamMembers
  .filter((member) => member.department === dept.name)
  .map(
    (member) =>
      `  - ${member.fullName} (${member.role}, Performance: ${member.performance.rating}/5.0)`
  )
  .join('\n')}
`
  )
  .join('\n')}
`
    : ''
}

${
  reportConfig.includeCharts
    ? `
DEPARTMENT VISUALIZATION DATA
---------------------------
[BUDGET DISTRIBUTION]
${departments.map((dept) => `${dept.name}: $${dept.budget.toLocaleString()} (${((dept.budget / departments.reduce((acc, d) => acc + d.budget, 0)) * 100).toFixed(1)}%)`).join('\n')}

[EMPLOYEE DISTRIBUTION]
${departments.map((dept) => `${dept.name}: ${dept.employees} employees (${((dept.employees / departments.reduce((acc, d) => acc + d.employees, 0)) * 100).toFixed(1)}%)`).join('\n')}

[PERFORMANCE COMPARISON]
${departments.map((dept) => `${dept.name}: ${dept.metrics.productivity}% productivity, ${dept.metrics.satisfaction}% satisfaction`).join('\n')}

[DEPARTMENT TYPE BREAKDOWN]
${departments
  .reduce((acc, dept) => {
    acc[dept.type] = (acc[dept.type] || 0) + 1;
    return acc;
  }, {})
  .map((count, type) => `${type}: ${count} departments`)
  .join('\n')}
`
    : ''
}

${
  reportConfig.includeRecommendations
    ? `
DEPARTMENT OPTIMIZATION RECOMMENDATIONS
---------------------------------------
FOR EACH DEPARTMENT:
${departments
  .map(
    (dept) => `
${dept.name}:
${dept.metrics.budgetUtilization > 110 ? '- Review and optimize budget spending' : ''}
${dept.metrics.productivity < 80 ? '- Implement productivity improvement initiatives' : ''}
${dept.metrics.satisfaction < 80 ? '- Address employee satisfaction concerns' : ''}
${dept.metrics.turnover > 15 ? '- Implement retention strategies' : ''}
${dept.employees < 5 ? '- Consider department consolidation or resource reallocation' : ''}
${dept.teams.length > 5 ? '- Optimize team structure for better coordination' : ''}
`
  )
  .join('\n')}

ORGANIZATIONAL RECOMMENDATIONS:
1. Regular department performance reviews and assessments
2. Budget optimization based on performance metrics
3. Cross-department collaboration initiatives
4. Standardized department performance benchmarks
5. Resource allocation based on department needs and performance
6. Department head training and development programs
7. Implement department-level KPIs and metrics
8. Foster healthy inter-department competition and collaboration

STRATEGIC RECOMMENDATIONS:
1. Align department goals with organizational objectives
2. Optimize department structure for efficiency
3. Implement departmental budget controls and monitoring
4. Develop department succession plans
5. Enhance department communication and coordination
6. Regular department health checks and assessments
7. Invest in departmental technology and resources
8. Monitor and address departmental performance trends
`
    : ''
}

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateTeamIndividualContent(teamMembers, departments, reportConfig) {
    return `
INDIVIDUAL TEAM MEMBER REPORT
=============================

Generated: ${new Date().toLocaleString()}
Report Type: Individual Reports
Export Format: ${reportConfig.format.toUpperCase()}
Export Period: ${reportConfig.period}

TEAM MEMBER OVERVIEW
--------------------
Total Members: ${teamMembers.length}
Active Members: ${teamMembers.filter((m) => m.status === 'active').length}
Average Performance: ${(teamMembers.reduce((acc, m) => acc + parseFloat(m.performance.rating), 0) / teamMembers.length || 0).toFixed(2)}/5.0

${
  reportConfig.includeIndividuals
    ? `
DETAILED MEMBER PROFILES
-------------------------
${teamMembers
  .map(
    (member, index) => `
MEMBER ${index + 1}: ${member.fullName}
=============================
ID: ${member.id}
Email: ${member.email}
Phone: ${member.phone || 'Not provided'}
Title: ${member.title}
Department: ${member.department}
Role: ${member.role}
Employment Type: ${member.employmentType.replace('-', ' ').charAt(0).toUpperCase() + member.employmentType.replace('-', ' ').slice(1)}
Status: ${member.status}
Start Date: ${new Date(member.startDate).toLocaleDateString()}
Avatar: ${member.avatar}

PERFORMANCE METRICS:
Overall Rating: ${member.performance.rating}/5.0
Completed Tasks: ${member.performance.completedTasks}
Ongoing Tasks: ${member.performance.ongoingTasks}
Attendance: ${member.performance.attendance}%
Productivity: ${member.performance.productivity}%

Performance Assessment:
- Rating: ${member.performance.rating >= 4.5 ? 'Excellent' : member.performance.rating >= 3.5 ? 'Good' : member.performance.rating >= 2.5 ? 'Average' : 'Needs Improvement'}
- Attendance: ${member.performance.attendance >= 95 ? 'Excellent' : member.performance.attendance >= 90 ? 'Good' : 'Needs Improvement'}
- Productivity: ${member.performance.productivity >= 90 ? 'Excellent' : member.performance.productivity >= 80 ? 'Good' : 'Needs Improvement'}

PROJECT INVOLVEMENT:
${member.projects.map((project) => `  - ${project.name} (${project.role}, ${project.status})`).join('\n')}

TRAINING AND DEVELOPMENT:
${member.training.map((training) => `  - ${training.name} (${training.status}, ${training.completionDate ? new Date(training.completionDate).toLocaleDateString() : 'Not completed'})`).join('\n')}

SKILLS AND EXPERTISE:
${member.skills || 'Not specified'}

PROFESSIONAL BIO:
${member.bio || 'Not provided'}

PERFORMANCE HISTORY:
- Current Rating: ${member.performance.rating}/5.0
- Task Completion Rate: ${((member.performance.completedTasks / (member.performance.completedTasks + member.performance.ongoingTasks)) * 100).toFixed(1)}%
- Reliability Score: ${member.performance.attendance >= 95 ? 'High' : member.performance.attendance >= 90 ? 'Medium' : 'Low'}
- Efficiency Score: ${member.performance.productivity >= 90 ? 'High' : member.performance.productivity >= 80 ? 'Medium' : 'Low'}

DEPARTMENT CONTRIBUTION:
- Department: ${member.department}
- Role: ${member.role}
- Projects: ${member.projects.length}
- Team Impact: ${member.performance.rating >= 4.0 ? 'High' : member.performance.rating >= 3.0 ? 'Medium' : 'Low'}

GROWTH AND DEVELOPMENT:
${
  member.training.length > 0
    ? `Training Completed: ${member.training.filter((t) => t.status === 'completed').length}/${member.training.length}
Current Training: ${member.training.filter((t) => t.status === 'in-progress').length}
Upcoming Training: ${member.training.filter((t) => t.status === 'upcoming').length}`
    : 'No training records available'
}

INDIVIDUAL RECOMMENDATIONS:
${
  member.performance.rating >= 4.5
    ? `
1. Consider for leadership roles and mentorship positions
2. Provide opportunities for advanced skill development
3. Involve in strategic decision-making processes
4. Recognize and reward exceptional performance
5. Offer career advancement opportunities`
    : member.performance.rating >= 3.5
      ? `
1. Focus on specific skill areas for improvement
2. Provide additional training and development opportunities
3. Set clear performance goals and expectations
4. Regular feedback and coaching sessions
5. Monitor progress and provide support`
      : `
1. Implement performance improvement plan
2. Provide intensive training and skill development
3. Closer supervision and mentoring
4. Regular performance reviews and feedback
5. Consider role reassignment if necessary`
}
`
  )
  .join('\n\n')}
`
    : ''
}

${
  reportConfig.includePerformance
    ? `
TEAM PERFORMANCE SUMMARY
------------------------
Top Performers (4.5+ rating):
${teamMembers
  .filter((m) => parseFloat(m.performance.rating) >= 4.5)
  .map((m) => `- ${m.fullName}: ${m.performance.rating}/5.0`)
  .join('\n')}

Average Performers (3.5-4.4 rating):
${teamMembers
  .filter((m) => parseFloat(m.performance.rating) >= 3.5 && parseFloat(m.performance.rating) < 4.5)
  .map((m) => `- ${m.fullName}: ${m.performance.rating}/5.0`)
  .join('\n')}

Below Average Performers (<3.5 rating):
${teamMembers
  .filter((m) => parseFloat(m.performance.rating) < 3.5)
  .map((m) => `- ${m.fullName}: ${m.performance.rating}/5.0`)
  .join('\n')}

PERFORMANCE DISTRIBUTION:
Excellent (4.5-5.0): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 4.5).length} members
Good (3.5-4.4): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 3.5 && parseFloat(m.performance.rating) < 4.5).length} members
Average (2.5-3.4): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 2.5 && parseFloat(m.performance.rating) < 3.5).length} members
Below Average (<2.5): ${teamMembers.filter((m) => parseFloat(m.performance.rating) < 2.5).length} members
`
    : ''
}

${
  reportConfig.includeCharts
    ? `
INDIVIDUAL PERFORMANCE VISUALIZATION
------------------------------------
[RATING DISTRIBUTION CHART]
${teamMembers.map((member) => `${member.fullName}: ${member.performance.rating}/5.0`).join('\n')}

[ATTENDANCE RATES]
${teamMembers.map((member) => `${member.fullName}: ${member.performance.attendance}%`).join('\n')}

[PRODUCTIVITY SCORES]
${teamMembers.map((member) => `${member.fullName}: ${member.performance.productivity}%`).join('\n')}

[TASK COMPLETION RATES]
${teamMembers.map((member) => `${member.fullName}: ${member.performance.completedTasks} completed, ${member.performance.ongoingTasks} ongoing`).join('\n')}

[DEPARTMENT DISTRIBUTION]
${teamMembers
  .reduce((acc, member) => {
    acc[member.department] = (acc[member.department] || 0) + 1;
    return acc;
  }, {})
  .map((count, dept) => `${dept}: ${count} members`)
  .join('\n')}

[ROLE DISTRIBUTION]
${teamMembers
  .reduce((acc, member) => {
    acc[member.role] = (acc[member.role] || 0) + 1;
    return acc;
  }, {})
  .map((count, role) => `${role}: ${count} members`)
  .join('\n')}
`
    : ''
}

${
  reportConfig.includeRecommendations
    ? `
INDIVIDUAL DEVELOPMENT RECOMMENDATIONS
-----------------------------------
FOR HIGH PERFORMERS:
${teamMembers
  .filter((m) => parseFloat(m.performance.rating) >= 4.5)
  .map(
    (m) => `
${m.fullName}:
- Consider for leadership training programs
- Provide mentorship opportunities
- Involve in strategic projects
- Offer advanced skill development
- Recognize achievements publicly
`
  )
  .join('\n')}

FOR IMPROVEMENT CANDIDATES:
${teamMembers
  .filter((m) => parseFloat(m.performance.rating) < 3.5)
  .map(
    (m) => `
${m.fullName}:
- Implement performance improvement plan
- Provide targeted training programs
- Assign mentor for guidance
- Set clear, achievable goals
- Regular progress monitoring
`
  )
  .join('\n')}

TEAM-WIDE RECOMMENDATIONS:
1. Implement individual development plans for all team members
2. Regular performance reviews and feedback sessions
3. Personalized training and development programs
4. Career path planning and advancement opportunities
5. Recognition and reward systems for high performers
6. Support systems for underperforming members
7. Skill gap analysis and training needs assessment
8. Regular team building and collaboration activities

MANAGEMENT RECOMMENDATIONS:
1. Conduct quarterly performance reviews
2. Implement 360-degree feedback systems
3. Provide regular coaching and mentoring
4. Set clear performance expectations and goals
5. Monitor individual and team progress trends
6. Address performance issues promptly
7. Foster a culture of continuous improvement
8. Invest in employee development and growth
`
    : ''
}

Generated: ${new Date().toLocaleString()}
    `;
  }

  function generateTeamComprehensiveContent(teamMembers, departments, reportConfig) {
    return `
COMPREHENSIVE TEAM ANALYSIS REPORT
===================================

Generated: ${new Date().toLocaleString()}
Report Type: Comprehensive Analysis
Export Format: ${reportConfig.format.toUpperCase()}
Export Period: ${reportConfig.period}

EXECUTIVE SUMMARY
-----------------
Total Team Members: ${teamMembers.length}
Total Departments: ${departments.length}
Overall Team Performance: ${(teamMembers.reduce((acc, m) => acc + parseFloat(m.performance.rating), 0) / teamMembers.length || 0).toFixed(2)}/5.0
Total Budget: $${departments.reduce((acc, dept) => acc + dept.budget, 0).toLocaleString()}
Average Department Size: ${(departments.reduce((acc, dept) => acc + dept.employees, 0) / departments.length || 0).toFixed(1)}

KEY PERFORMANCE INDICATORS:
- Team Satisfaction: ${(teamMembers.reduce((acc, m) => acc + m.performance.attendance, 0) / teamMembers.length || 0).toFixed(1)}%
- Team Productivity: ${(teamMembers.reduce((acc, m) => acc + m.performance.productivity, 0) / teamMembers.length || 0).toFixed(1)}%
- Budget Utilization: ${(departments.reduce((acc, dept) => acc + dept.metrics.budgetUtilization, 0) / departments.length || 0).toFixed(1)}%
- Employee Retention: ${(100 - (departments.reduce((acc, dept) => acc + dept.metrics.turnover, 0) / departments.length || 0)).toFixed(1)}%

${
  reportConfig.includeDepartments
    ? `
DEPARTMENT ANALYSIS
-------------------
${departments
  .map(
    (dept, index) => `
${index + 1}. ${dept.name} (${dept.code})
   Head: ${dept.head || 'Not assigned'}
   Employees: ${dept.employees}
   Budget: $${dept.budget.toLocaleString()}
   Performance: ${dept.metrics.productivity}% productivity, ${dept.metrics.satisfaction}% satisfaction
   Status: ${dept.status}
   Type: ${dept.type}
   Location: ${dept.location || 'Not specified'}
   Teams: ${dept.teams.length}
   Budget Utilization: ${dept.metrics.budgetUtilization}%
   Turnover Rate: ${dept.metrics.turnover}%
`
  )
  .join('\n')}
`
    : ''
}

${
  reportConfig.includeIndividuals
    ? `
TEAM MEMBER ANALYSIS
--------------------
${teamMembers
  .map(
    (member, index) => `
${index + 1}. ${member.fullName}
   Email: ${member.email}
   Title: ${member.title}
   Department: ${member.department}
   Role: ${member.role}
   Performance: ${member.performance.rating}/5.0
   Attendance: ${member.performance.attendance}%
   Productivity: ${member.performance.productivity}%
   Status: ${member.status}
   Projects: ${member.projects.length}
   Start Date: ${new Date(member.startDate).toLocaleDateString()}
   Employment: ${member.employmentType.replace('-', ' ').charAt(0).toUpperCase() + member.employmentType.replace('-', ' ').slice(1)}
`
  )
  .join('\n')}
`
    : ''
}

${
  reportConfig.includePerformance
    ? `
PERFORMANCE ANALYSIS
-------------------
Team Performance Distribution:
- Excellent (4.5-5.0): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 4.5).length} members (${((teamMembers.filter((m) => parseFloat(m.performance.rating) >= 4.5).length / teamMembers.length) * 100).toFixed(1)}%)
- Good (3.5-4.4): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 3.5 && parseFloat(m.performance.rating) < 4.5).length} members (${((teamMembers.filter((m) => parseFloat(m.performance.rating) >= 3.5 && parseFloat(m.performance.rating) < 4.5).length / teamMembers.length) * 100).toFixed(1)}%)
- Average (2.5-3.4): ${teamMembers.filter((m) => parseFloat(m.performance.rating) >= 2.5 && parseFloat(m.performance.rating) < 3.5).length} members (${((teamMembers.filter((m) => parseFloat(m.performance.rating) >= 2.5 && parseFloat(m.performance.rating) < 3.5).length / teamMembers.length) * 100).toFixed(1)}%)
- Below Average (<2.5): ${teamMembers.filter((m) => parseFloat(m.performance.rating) < 2.5).length} members (${((teamMembers.filter((m) => parseFloat(m.performance.rating) < 2.5).length / teamMembers.length) * 100).toFixed(1)}%)

Department Performance Rankings:
${departments.map((dept, index) => `${index + 1}. ${dept.name}: ${dept.metrics.productivity}% productivity, ${dept.metrics.satisfaction}% satisfaction`).join('\n')}

Top Performing Departments:
${departments
  .sort((a, b) => b.metrics.productivity - a.metrics.productivity)
  .slice(0, 3)
  .map((dept, index) => `${index + 1}. ${dept.name}: ${dept.metrics.productivity}% productivity`)
  .join('\n')}

Departments Needing Attention:
${departments
  .filter((dept) => dept.metrics.productivity < 80 || dept.metrics.satisfaction < 80)
  .map(
    (dept) =>
      `- ${dept.name}: ${dept.metrics.productivity}% productivity, ${dept.metrics.satisfaction}% satisfaction`
  )
  .join('\n')}

Task Completion Statistics:
- Total Completed Tasks: ${teamMembers.reduce((acc, m) => acc + m.performance.completedTasks, 0)}
- Total Ongoing Tasks: ${teamMembers.reduce((acc, m) => acc + m.performance.ongoingTasks, 0)}
- Overall Completion Rate: ${((teamMembers.reduce((acc, m) => acc + m.performance.completedTasks, 0) / teamMembers.reduce((acc, m) => acc + m.performance.completedTasks + m.performance.ongoingTasks, 0)) * 100).toFixed(1)}%
`
    : ''
}

${
  reportConfig.includeCharts
    ? `
COMPREHENSIVE VISUALIZATION DATA
--------------------------------
[TEAM COMPOSITION CHART]
Total Members: ${teamMembers.length}
By Department: ${departments.map((dept) => `${dept.name}: ${dept.employees}`).join(', ')}
By Role: ${teamMembers
        .reduce((acc, member) => {
          acc[member.role] = (acc[member.role] || 0) + 1;
          return acc;
        }, {})
        .map((count, role) => `${role}: ${count}`)
        .join(', ')}

[PERFORMANCE HEATMAP]
${teamMembers.map((member) => `${member.fullName}: ${member.performance.rating}/5.0`).join('\n')}

[DEPARTMENT BUDGET ALLOCATION]
${departments.map((dept) => `${dept.name}: $${dept.budget.toLocaleString()} (${((dept.budget / departments.reduce((acc, d) => acc + d.budget, 0)) * 100).toFixed(1)}%)`).join('\n')}

[PRODUCTIVITY VS SATISFACTION SCATTER PLOT]
${departments.map((dept) => `${dept.name}: (${dept.metrics.productivity}%, ${dept.metrics.satisfaction}%)`).join('\n')}

[ATTENDANCE DISTRIBUTION]
${teamMembers.map((member) => `${member.fullName}: ${member.performance.attendance}%`).join('\n')}

[TRAINING COMPLETION RATES]
${teamMembers.map((member) => `${member.fullName}: ${member.training.filter((t) => t.status === 'completed').length}/${member.training.length} completed`).join('\n')}

[PROJECT DISTRIBUTION]
${teamMembers.map((member) => `${member.fullName}: ${member.projects.length} projects`).join('\n')}
`
    : ''
}

${
  reportConfig.includeRecommendations
    ? `
STRATEGIC RECOMMENDATIONS
-------------------------
ORGANIZATIONAL IMPROVEMENTS:
1. Implement comprehensive performance management system
2. Establish clear KPIs and performance benchmarks
3. Develop talent management and succession planning
4. Enhance employee engagement and satisfaction programs
5. Optimize resource allocation and budget management
6. Foster cross-department collaboration and communication
7. Implement regular team health assessments
8. Develop data-driven decision-making processes

DEPARTMENT-SPECIFIC ACTIONS:
${departments
  .map(
    (dept) => `
${dept.name}:
${dept.metrics.productivity < 80 ? '- Implement productivity improvement initiatives and process optimization' : ''}
${dept.metrics.satisfaction < 80 ? '- Address employee satisfaction through engagement programs and feedback mechanisms' : ''}
${dept.metrics.turnover > 15 ? '- Implement retention strategies and address turnover causes' : ''}
${dept.metrics.budgetUtilization > 110 ? '- Review and optimize budget spending and cost controls' : ''}
${dept.employees < 5 ? '- Consider department consolidation or resource reallocation' : ''}
`
  )
  .join('\n')}

INDIVIDUAL DEVELOPMENT STRATEGIES:
${teamMembers
  .filter((m) => parseFloat(m.performance.rating) >= 4.5)
  .map(
    (m) => `
${m.fullName}: Leadership development, advanced training, mentorship opportunities, strategic involvement
`
  )
  .join('\n')}

${teamMembers
  .filter((m) => parseFloat(m.performance.rating) < 3.5)
  .map(
    (m) => `
${m.fullName}: Performance improvement plan, targeted training, coaching support, skill development
`
  )
  .join('\n')}

PERFORMANCE ENHANCEMENT INITIATIVES:
1. Quarterly performance reviews and goal setting
2. Individual development plans for all team members
3. Training and development programs tailored to needs
4. Recognition and reward systems for high performers
5. Support systems for underperforming employees
6. Regular team building and collaboration activities
7. Cross-functional project opportunities
8. Mentorship and coaching programs

RESOURCE OPTIMIZATION:
1. Budget reallocation based on performance metrics
2. Staffing level optimization across departments
3. Technology and resource investment priorities
4. Meeting space and facility utilization improvements
5. Equipment and software license management
6. Cross-department resource sharing initiatives
7. Vendor and supplier relationship optimization
8. Cost reduction and efficiency improvement programs

MONITORING AND EVALUATION:
1. Monthly performance dashboards and reports
2. Quarterly department health assessments
3. Annual comprehensive team analysis
4. Regular stakeholder feedback collection
5. Performance trend analysis and forecasting
6. Benchmarking against industry standards
7. Continuous improvement process implementation
8. Success metrics and KPI tracking
`
    : ''
}

Generated: ${new Date().toLocaleString()}
    `;
  }

  function downloadTeamReport(teamReportData, format) {
    let content, filename, mimeType;

    switch (format) {
      case 'pdf':
        content = `PDF Export: ${teamReportData.content}`;
        filename = `team_report_${teamReportData.reportId}.pdf`;
        mimeType = 'application/pdf';
        break;
      case 'excel':
        content = `Excel Export: ${teamReportData.content}`;
        filename = `team_report_${teamReportData.reportId}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'powerpoint':
        content = `PowerPoint Export: ${teamReportData.content}`;
        filename = `team_report_${teamReportData.reportId}.pptx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        break;
      case 'json':
        content = JSON.stringify(teamReportData, null, 2);
        filename = `team_report_${teamReportData.reportId}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = convertTeamReportToCSV(teamReportData);
        filename = `team_report_${teamReportData.reportId}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        content = teamReportData.content;
        filename = `team_report_${teamReportData.reportId}.txt`;
        mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function convertTeamReportToCSV(teamReportData) {
    let csv =
      'Report ID,Type,Format,Period,Generated,Total Members,Total Departments,Average Performance,Total Budget\n';
    csv += `${teamReportData.reportId},${teamReportData.type},${teamReportData.format},${teamReportData.period},${new Date(teamReportData.generated).toLocaleDateString()},${teamReportData.summary.totalMembers},${teamReportData.summary.totalDepartments},${teamReportData.summary.averagePerformance},${teamReportData.summary.totalBudget}\n`;
    return csv;
  }

  function showTeamReportSummary(teamReportData) {
    const summaryModal = document.createElement('div');
    summaryModal.id = 'team-report-summary-modal';
    summaryModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
    `;

    summaryModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); margin: 0;">📊 Team Report Exported Successfully</h3>
                <button onclick="closeTeamReportSummary()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--success-color), var(--primary-color)); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; color: white;">
                <h4 style="margin: 0 0 1rem 0;">Export Summary</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${teamReportData.format.toUpperCase()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Format</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${teamReportData.type.charAt(0).toUpperCase() + teamReportData.type.slice(1)}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Type</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${teamReportData.summary.totalMembers}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Team Members</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; font-weight: bold;">${teamReportData.period}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Period</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">Report Details</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Report ID</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${teamReportData.reportId}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Generated</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${new Date(teamReportData.generated).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Departments</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${teamReportData.summary.totalDepartments}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Avg Performance</div>
                        <div style="color: var(--text-primary); font-weight: 500;">${teamReportData.summary.averagePerformance.toFixed(2)}/5.0</div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeTeamReportSummary()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(summaryModal);

    // Add click outside to close
    summaryModal.addEventListener('click', (e) => {
      if (e.target === summaryModal) {
        closeTeamReportSummary();
      }
    });

    // Show modal
    setTimeout(() => {
      summaryModal.style.display = 'flex';
    }, 100);
  }

  function closeTeamReportSummary() {
    const modal = document.getElementById('team-report-summary-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  // Export Analysis Results function for mock-data.js integration
  function exportAnalysisResults() {
    console.log('Exporting analysis results...');

    // Create export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'export-analysis-modal';
    exportModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📊 Export Analysis Results</h3>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Export Format</label>
                <select id="analysis-export-format" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="txt">Text Report</option>
                    <option value="pdf">PDF Report</option>
                </select>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Include Options</label>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Analysis Summary
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Detailed Metrics
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Recommendations
                    </label>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeExportAnalysisModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="processAnalysisExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Export
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeExportAnalysisModal();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeExportAnalysisModal() {
    const modal = document.getElementById('export-analysis-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function processAnalysisExport() {
    const format = document.getElementById('analysis-export-format').value;

    // Show progress
    const progressModal = document.createElement('div');
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; text-align: center;">
            <div style="width: 100%; height: 8px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 1rem; overflow: hidden;">
                <div id="analysis-export-bar" style="height: 100%; background: var(--primary-color); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="analysis-export-progress" style="color: var(--text-primary); font-weight: 500;">0%</div>
            <div id="analysis-export-status" style="color: var(--text-secondary); margin-top: 0.5rem;">Preparing export...</div>
        </div>
    `;

    document.body.appendChild(progressModal);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          closeExportAnalysisModal();
          showNotification('Analysis results exported successfully!', 'success');

          // Create download
          const content = generateAnalysisExportContent(format);
          const filename = `analysis-results-${new Date().toISOString().split('T')[0]}.${format}`;
          downloadFile(content, filename, getMimeType(format));
        }, 500);
      }

      document.getElementById('analysis-export-bar').style.width = progress + '%';
      document.getElementById('analysis-export-progress').textContent = Math.round(progress) + '%';

      const statusElement = document.getElementById('analysis-export-status');
      if (progress < 25) {
        statusElement.textContent = 'Collecting analysis data...';
      } else if (progress < 50) {
        statusElement.textContent = 'Processing metrics...';
      } else if (progress < 75) {
        statusElement.textContent = 'Generating report...';
      } else {
        statusElement.textContent = 'Finalizing export...';
      }
    }, 300);
  }

  function generateAnalysisExportContent(format) {
    const timestamp = new Date().toLocaleString();
    const mockData = {
      summary: 'Technical Debt Analysis Results',
      timestamp: timestamp,
      metrics: {
        totalFiles: 150,
        linesOfCode: 45000,
        technicalDebt: 'Medium',
        codeQuality: 85,
        securityIssues: 12,
        performanceScore: 78,
      },
      recommendations: [
        'Refactor complex functions to reduce cyclomatic complexity',
        'Update outdated dependencies',
        'Implement additional security measures',
        'Optimize database queries for better performance',
      ],
    };

    if (format === 'json') {
      return JSON.stringify(mockData, null, 2);
    } else if (format === 'csv') {
      return `Metric,Value\nTotal Files,${mockData.metrics.totalFiles}\nLines of Code,${mockData.metrics.linesOfCode}\nCode Quality,${mockData.metrics.codeQuality}%\nSecurity Issues,${mockData.metrics.securityIssues}\nPerformance Score,${mockData.metrics.performanceScore}`;
    } else {
      return `
ANALYSIS RESULTS REPORT
========================
Generated: ${timestamp}

SUMMARY
-------
${mockData.summary}

METRICS
-------
Total Files: ${mockData.metrics.totalFiles}
Lines of Code: ${mockData.metrics.linesOfCode}
Technical Debt: ${mockData.metrics.technicalDebt}
Code Quality: ${mockData.metrics.codeQuality}%
Security Issues: ${mockData.metrics.securityIssues}
Performance Score: ${mockData.metrics.performanceScore}%

RECOMMENDATIONS
---------------
${mockData.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}
        `.trim();
    }
  }

  // Export Performance Report function
  function exportPerformanceReport() {
    console.log('Exporting performance report...');

    // Create performance export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'performance-export-modal';
    exportModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📈 Export Performance Report</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Export Format</label>
                    <select id="performance-export-format" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="pdf">PDF Report</option>
                        <option value="xlsx">Excel</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Time Period</label>
                    <select id="performance-time-period" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                        <option value="365">Last Year</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Include Metrics</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Response Times
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Throughput
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Error Rates
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        CPU Usage
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Memory Usage
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Database Performance
                    </label>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: flex; align-items: center; color: var(--text-secondary);">
                    <input type="checkbox" checked style="margin-right: 0.5rem;">
                    Include performance trends and charts
                </label>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closePerformanceExportModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="processPerformanceExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Export Report
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closePerformanceExportModal();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closePerformanceExportModal() {
    const modal = document.getElementById('performance-export-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function processPerformanceExport() {
    const format = document.getElementById('performance-export-format').value;
    const timePeriod = document.getElementById('performance-time-period').value;

    // Show progress
    const progressModal = document.createElement('div');
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; text-align: center;">
            <div style="width: 100%; height: 8px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 1rem; overflow: hidden;">
                <div id="performance-export-bar" style="height: 100%; background: var(--primary-color); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="performance-export-progress" style="color: var(--text-primary); font-weight: 500;">0%</div>
            <div id="performance-export-status" style="color: var(--text-secondary); margin-top: 0.5rem;">Collecting performance data...</div>
        </div>
    `;

    document.body.appendChild(progressModal);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          closePerformanceExportModal();

          // Generate content based on format
          const content = generatePerformanceReportContent(format, timePeriod);
          let filename, mimeType;

          if (format === 'json') {
            filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            mimeType = 'application/json';
          } else if (format === 'csv') {
            filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            mimeType = 'text/csv';
          } else if (format === 'xlsx') {
            filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (format === 'pdf') {
            filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
            mimeType = 'application/pdf';
          } else {
            filename = `performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            mimeType = 'text/plain';
          }

          // Download the file
          downloadExportContent(content, filename, mimeType);
          showNotification('Performance report exported successfully!', 'success');
        }, 500);
      }

      document.getElementById('performance-export-bar').style.width = progress + '%';
      document.getElementById('performance-export-progress').textContent =
        Math.round(progress) + '%';

      const statusElement = document.getElementById('performance-export-status');
      if (progress < 20) {
        statusElement.textContent = 'Collecting performance metrics...';
      } else if (progress < 40) {
        statusElement.textContent = 'Analyzing response times...';
      } else if (progress < 60) {
        statusElement.textContent = 'Processing throughput data...';
      } else if (progress < 80) {
        statusElement.textContent = 'Generating charts...';
      } else {
        statusElement.textContent = 'Finalizing report...';
      }
    }, 350);
  }

  function generatePerformanceReportContent(format, timePeriod) {
    const timestamp = new Date().toLocaleString();
    const periodText =
      timePeriod === '7'
        ? '7 Days'
        : timePeriod === '30'
          ? '30 Days'
          : timePeriod === '90'
            ? '90 Days'
            : '1 Year';

    const performanceData = {
      reportInfo: {
        title: 'Performance Analysis Report',
        generated: timestamp,
        period: periodText,
        format: format.toUpperCase(),
      },
      summary: {
        avgResponseTime: 245,
        peakResponseTime: 1200,
        throughput: 1250,
        errorRate: 2.3,
        uptime: 99.8,
        cpuUsage: 65,
        memoryUsage: 78,
      },
      metrics: {
        responseTimes: {
          average: 245,
          median: 220,
          p95: 450,
          p99: 800,
        },
        throughput: {
          requestsPerSecond: 1250,
          peakRPS: 2100,
          totalRequests: 7850000,
        },
        errors: {
          errorRate: 2.3,
          totalErrors: 180550,
          criticalErrors: 45,
        },
        resources: {
          cpuUsage: 65,
          memoryUsage: 78,
          diskUsage: 45,
          networkIO: 120,
        },
        database: {
          avgQueryTime: 45,
          slowQueries: 234,
          connectionPoolUsage: 78,
          cacheHitRate: 85,
        },
      },
      trends: [
        { date: '2024-05-14', responseTime: 230, throughput: 1180, errorRate: 2.1 },
        { date: '2024-05-15', responseTime: 245, throughput: 1250, errorRate: 2.3 },
        { date: '2024-05-16', responseTime: 260, throughput: 1320, errorRate: 2.5 },
        { date: '2024-05-17', responseTime: 238, throughput: 1280, errorRate: 2.2 },
        { date: '2024-05-18', responseTime: 225, throughput: 1350, errorRate: 1.9 },
        { date: '2024-05-19', responseTime: 240, throughput: 1290, errorRate: 2.4 },
        { date: '2024-05-20', responseTime: 255, throughput: 1400, errorRate: 2.0 },
      ],
      recommendations: [
        'Optimize database queries to reduce response times',
        'Implement caching for frequently accessed resources',
        'Scale horizontally during peak traffic periods',
        'Monitor and address memory leaks in long-running processes',
        'Implement better error handling and retry mechanisms',
      ],
    };

    if (format === 'json') {
      return JSON.stringify(performanceData, null, 2);
    } else if (format === 'csv') {
      return generatePerformanceReportCSV(performanceData);
    } else if (format === 'xlsx') {
      return generatePerformanceReportExcel(performanceData);
    } else if (format === 'pdf') {
      return generatePerformanceReportPDF(performanceData);
    } else {
      return generatePerformanceReportText(performanceData);
    }
  }

  function generatePerformanceReportCSV(performanceData) {
    let csv = `PERFORMANCE ANALYSIS REPORT - ${performanceData.reportInfo.period}\n`;
    csv += `Generated,${performanceData.reportInfo.generated}\n\n`;

    csv += 'EXECUTIVE SUMMARY\n';
    csv += 'Metric,Value\n';
    csv += `Average Response Time,${performanceData.summary.avgResponseTime}ms\n`;
    csv += `Peak Response Time,${performanceData.summary.peakResponseTime}ms\n`;
    csv += `Throughput,${performanceData.summary.throughput} requests/second\n`;
    csv += `Error Rate,${performanceData.summary.errorRate}%\n`;
    csv += `System Uptime,${performanceData.summary.uptime}%\n`;
    csv += `CPU Usage,${performanceData.summary.cpuUsage}%\n`;
    csv += `Memory Usage,${performanceData.summary.memoryUsage}%\n\n`;

    csv += 'PERFORMANCE TRENDS\n';
    csv += 'Date,Response Time (ms),Throughput (RPS),Error Rate (%)\n';
    performanceData.trends.forEach((trend) => {
      csv += `${trend.date},${trend.responseTime},${trend.throughput},${trend.errorRate}\n`;
    });

    return csv;
  }

  function generatePerformanceReportPDF(performanceData) {
    let pdf = `
PERFORMANCE ANALYSIS REPORT
===========================
Generated: ${performanceData.reportInfo.generated}
Report Period: ${performanceData.reportInfo.period}
Export Format: ${performanceData.reportInfo.format}

EXECUTIVE SUMMARY
-----------------
Average Response Time: ${performanceData.summary.avgResponseTime}ms
Peak Response Time: ${performanceData.summary.peakResponseTime}ms
Throughput: ${performanceData.summary.throughput} requests/second
Error Rate: ${performanceData.summary.errorRate}%
System Uptime: ${performanceData.summary.uptime}%
CPU Usage: ${performanceData.summary.cpuUsage}%
Memory Usage: ${performanceData.summary.memoryUsage}%

DETAILED METRICS
---------------

Response Times:
- Average: ${performanceData.metrics.responseTimes.average}ms
- Median: ${performanceData.metrics.responseTimes.median}ms
- 95th Percentile: ${performanceData.metrics.responseTimes.p95}ms
- 99th Percentile: ${performanceData.metrics.responseTimes.p99}ms

Throughput:
- Requests per Second: ${performanceData.metrics.throughput.requestsPerSecond}
- Peak RPS: ${performanceData.metrics.throughput.peakRPS}
- Total Requests: ${performanceData.metrics.throughput.totalRequests.toLocaleString()}

Error Analysis:
- Error Rate: ${performanceData.metrics.errors.errorRate}%
- Total Errors: ${performanceData.metrics.errors.totalErrors.toLocaleString()}
- Critical Errors: ${performanceData.metrics.errors.criticalErrors}

Resource Usage:
- CPU Usage: ${performanceData.metrics.resources.cpuUsage}%
- Memory Usage: ${performanceData.metrics.resources.memoryUsage}%
- Disk Usage: ${performanceData.metrics.resources.diskUsage}%
- Network I/O: ${performanceData.metrics.resources.networkIO} MB/s

Database Performance:
- Average Query Time: ${performanceData.metrics.database.avgQueryTime}ms
- Slow Queries: ${performanceData.metrics.database.slowQueries}
- Connection Pool Usage: ${performanceData.metrics.database.connectionPoolUsage}%
- Cache Hit Rate: ${performanceData.metrics.database.cacheHitRate}%

PERFORMANCE TRENDS
------------------
`;
    performanceData.trends.forEach((trend) => {
      pdf += `
${trend.date}:
  Response Time: ${trend.responseTime}ms
  Throughput: ${trend.throughput} RPS
  Error Rate: ${trend.errorRate}%
`;
    });

    pdf += `
RECOMMENDATIONS
---------------
`;
    performanceData.recommendations.forEach((rec, index) => {
      pdf += `${index + 1}. ${rec}\n`;
    });

    pdf += `
Generated: ${performanceData.reportInfo.generated}
`;

    return pdf;
  }

  function generatePerformanceReportExcel(performanceData) {
    let html = `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Performance Analysis Report</title>
      <style>
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #667eea; color: white; font-weight: bold; }
        .section-header { background-color: #4CAF50; color: white; font-weight: bold; font-size: 16px; padding: 10px; }
        .summary-cell { background-color: #e3f2fd; font-weight: bold; }
        .good-performance { background-color: #c8e6c9; }
        .warning-performance { background-color: #fff9c4; }
        .critical-performance { background-color: #ffcdd2; }
        h1 { color: #333; }
        h2 { color: #667eea; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h1>Performance Analysis Report</h1>
      <p><strong>Generated:</strong> ${performanceData.reportInfo.generated} | <strong>Period:</strong> ${performanceData.reportInfo.period}</p>

      <h2>Executive Summary</h2>
      <table>
        <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
        <tr><td class="summary-cell">Average Response Time</td><td>${performanceData.summary.avgResponseTime}ms</td><td class="good-performance">Good</td></tr>
        <tr><td class="summary-cell">Peak Response Time</td><td>${performanceData.summary.peakResponseTime}ms</td><td class="warning-performance">Warning</td></tr>
        <tr><td class="summary-cell">Throughput</td><td>${performanceData.summary.throughput} requests/second</td><td class="good-performance">Good</td></tr>
        <tr><td class="summary-cell">Error Rate</td><td>${performanceData.summary.errorRate}%</td><td class="good-performance">Good</td></tr>
        <tr><td class="summary-cell">System Uptime</td><td>${performanceData.summary.uptime}%</td><td class="good-performance">Excellent</td></tr>
        <tr><td class="summary-cell">CPU Usage</td><td>${performanceData.summary.cpuUsage}%</td><td class="warning-performance">Moderate</td></tr>
        <tr><td class="summary-cell">Memory Usage</td><td>${performanceData.summary.memoryUsage}%</td><td class="warning-performance">Moderate</td></tr>
      </table>

      <h2>Detailed Metrics</h2>
      <table>
        <tr><th>Category</th><th>Metric</th><th>Value</th></tr>
        <tr><td rowspan="4">Response Times</td><td>Average</td><td>${performanceData.metrics.responseTimes.average}ms</td></tr>
        <tr><td>Median</td><td>${performanceData.metrics.responseTimes.median}ms</td></tr>
        <tr><td>95th Percentile</td><td>${performanceData.metrics.responseTimes.p95}ms</td></tr>
        <tr><td>99th Percentile</td><td>${performanceData.metrics.responseTimes.p99}ms</td></tr>
        <tr><td rowspan="3">Throughput</td><td>Requests per Second</td><td>${performanceData.metrics.throughput.requestsPerSecond}</td></tr>
        <tr><td>Peak RPS</td><td>${performanceData.metrics.throughput.peakRPS}</td></tr>
        <tr><td>Total Requests</td><td>${performanceData.metrics.throughput.totalRequests.toLocaleString()}</td></tr>
        <tr><td rowspan="3">Error Analysis</td><td>Error Rate</td><td>${performanceData.metrics.errors.errorRate}%</td></tr>
        <tr><td>Total Errors</td><td>${performanceData.metrics.errors.totalErrors.toLocaleString()}</td></tr>
        <tr><td>Critical Errors</td><td>${performanceData.metrics.errors.criticalErrors}</td></tr>
        <tr><td rowspan="4">Resource Usage</td><td>CPU Usage</td><td>${performanceData.metrics.resources.cpuUsage}%</td></tr>
        <tr><td>Memory Usage</td><td>${performanceData.metrics.resources.memoryUsage}%</td></tr>
        <tr><td>Disk Usage</td><td>${performanceData.metrics.resources.diskUsage}%</td></tr>
        <tr><td>Network I/O</td><td>${performanceData.metrics.resources.networkIO} MB/s</td></tr>
        <tr><td rowspan="4">Database Performance</td><td>Average Query Time</td><td>${performanceData.metrics.database.avgQueryTime}ms</td></tr>
        <tr><td>Slow Queries</td><td>${performanceData.metrics.database.slowQueries}</td></tr>
        <tr><td>Connection Pool Usage</td><td>${performanceData.metrics.database.connectionPoolUsage}%</td></tr>
        <tr><td>Cache Hit Rate</td><td>${performanceData.metrics.database.cacheHitRate}%</td></tr>
      </table>

      <h2>Performance Trends</h2>
      <table>
        <tr><th>Date</th><th>Response Time (ms)</th><th>Throughput (RPS)</th><th>Error Rate (%)</th></tr>
`;

    performanceData.trends.forEach((trend) => {
      const perfClass =
        trend.responseTime < 250
          ? 'good-performance'
          : trend.responseTime < 300
            ? 'warning-performance'
            : 'critical-performance';
      html += `<tr class="${perfClass}">
        <td>${trend.date}</td>
        <td>${trend.responseTime}</td>
        <td>${trend.throughput}</td>
        <td>${trend.errorRate}</td>
      </tr>`;
    });

    html += `</table>

      <h2>Recommendations</h2>
      <table>
        <tr><th>#</th><th>Recommendation</th></tr>
`;

    performanceData.recommendations.forEach((rec, index) => {
      html += `<tr>
        <td>${index + 1}</td>
        <td>${rec}</td>
      </tr>`;
    });

    html += `</table>
    </body>
    </html>
  `;

    return html;
  }

  function generatePerformanceReportText(performanceData) {
    return `
PERFORMANCE ANALYSIS REPORT
===========================
Generated: ${performanceData.reportInfo.generated}
Report Period: ${performanceData.reportInfo.period}

EXECUTIVE SUMMARY
-----------------
Average Response Time: ${performanceData.summary.avgResponseTime}ms
Throughput: ${performanceData.summary.throughput} requests/second
Error Rate: ${performanceData.summary.errorRate}%

PERFORMANCE TRENDS
------------------
${performanceData.trends.map((trend) => `${trend.date}: ${trend.responseTime}ms`).join('\n')}

RECOMMENDATIONS
---------------
${performanceData.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

Generated: ${performanceData.reportInfo.generated}
        `.trim();
  }

  // Export Upload Report function
  function exportUploadReport() {
    console.log('Exporting upload report...');

    // Create upload export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'upload-export-modal';
    exportModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">📤 Export Upload Report</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Export Format</label>
                    <select id="upload-export-format" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="pdf">PDF Report</option>
                        <option value="xlsx">Excel</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Time Period</label>
                    <select id="upload-time-period" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="24">Last 24 Hours</option>
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Include Data</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Upload Statistics
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        File Types
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Upload Speed
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Failed Uploads
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Storage Usage
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        User Activity
                    </label>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: flex; align-items: center; color: var(--text-secondary);">
                    <input type="checkbox" checked style="margin-right: 0.5rem;">
                    Include upload trends and analytics
                </label>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeUploadExportModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="processUploadExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Export Report
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeUploadExportModal();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeUploadExportModal() {
    const modal = document.getElementById('upload-export-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function processUploadExport() {
    const format = document.getElementById('upload-export-format').value;
    const timePeriod = document.getElementById('upload-time-period').value;

    // Show progress
    const progressModal = document.createElement('div');
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; text-align: center;">
            <div style="width: 100%; height: 8px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 1rem; overflow: hidden;">
                <div id="upload-export-bar" style="height: 100%; background: var(--primary-color); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="upload-export-progress" style="color: var(--text-primary); font-weight: 500;">0%</div>
            <div id="upload-export-status" style="color: var(--text-secondary); margin-top: 0.5rem;">Collecting upload data...</div>
        </div>
    `;

    document.body.appendChild(progressModal);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          closeUploadExportModal();

          // Generate content based on format
          const content = generateUploadReportContent(format, timePeriod);
          let filename, mimeType;

          if (format === 'json') {
            filename = `upload-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            mimeType = 'application/json';
          } else if (format === 'csv') {
            filename = `upload-report-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            mimeType = 'text/csv';
          } else if (format === 'xlsx') {
            filename = `upload-report-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (format === 'pdf') {
            filename = `upload-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
            mimeType = 'application/pdf';
          } else {
            filename = `upload-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            mimeType = 'text/plain';
          }

          // Download the file
          downloadExportContent(content, filename, mimeType);
          showNotification('Upload report exported successfully!', 'success');
        }, 500);
      }

      document.getElementById('upload-export-bar').style.width = progress + '%';
      document.getElementById('upload-export-progress').textContent = Math.round(progress) + '%';

      const statusElement = document.getElementById('upload-export-status');
      if (progress < 20) {
        statusElement.textContent = 'Collecting upload statistics...';
      } else if (progress < 40) {
        statusElement.textContent = 'Analyzing file types...';
      } else if (progress < 60) {
        statusElement.textContent = 'Processing upload speeds...';
      } else if (progress < 80) {
        statusElement.textContent = 'Generating analytics...';
      } else {
        statusElement.textContent = 'Finalizing report...';
      }
    }, 350);
  }

  function generateUploadReportContent(format, timePeriod) {
    const timestamp = new Date().toLocaleString();
    const periodText =
      timePeriod === '24'
        ? '24 Hours'
        : timePeriod === '7'
          ? '7 Days'
          : timePeriod === '30'
            ? '30 Days'
            : '90 Days';

    const uploadData = {
      reportInfo: {
        title: 'Upload Activity Report',
        generated: timestamp,
        period: periodText,
        format: format.toUpperCase(),
      },
      summary: {
        totalUploads: 15420,
        successfulUploads: 14890,
        failedUploads: 530,
        totalSize: 2.8,
        avgUploadSpeed: 15.2,
        peakUploadSpeed: 45.8,
        storageUsed: 78.5,
      },
      statistics: {
        uploads: {
          total: 15420,
          successful: 14890,
          failed: 530,
          successRate: 96.6,
        },
        size: {
          totalSizeGB: 2.8,
          avgSizeMB: 185,
          largestFileMB: 2048,
          smallestFileKB: 12,
        },
        speed: {
          avgSpeedMBps: 15.2,
          peakSpeedMBps: 45.8,
          minSpeedMBps: 2.1,
          avgUploadTimeSec: 12.3,
        },
        storage: {
          usedGB: 78.5,
          availableGB: 121.5,
          totalGB: 200,
          utilizationPercent: 39.3,
        },
      },
      fileTypes: [
        { type: 'Images', count: 6780, sizeGB: 1.2, percentage: 43.9 },
        { type: 'Documents', count: 4520, sizeGB: 0.8, percentage: 29.3 },
        { type: 'Videos', count: 1890, sizeGB: 0.9, percentage: 12.3 },
        { type: 'Archives', count: 1230, sizeGB: 0.4, percentage: 8.0 },
        { type: 'Other', count: 1000, sizeGB: 0.3, percentage: 6.5 },
      ],
      hourlyActivity: [
        { hour: '00:00', uploads: 45, sizeMB: 120 },
        { hour: '04:00', uploads: 23, sizeMB: 85 },
        { hour: '08:00', uploads: 180, sizeMB: 450 },
        { hour: '12:00', uploads: 220, sizeMB: 580 },
        { hour: '16:00', uploads: 195, sizeMB: 520 },
        { hour: '20:00', uploads: 125, sizeMB: 340 },
      ],
      failedUploads: [
        { reason: 'File size too large', count: 234, percentage: 44.2 },
        { reason: 'Unsupported format', count: 156, percentage: 29.4 },
        { reason: 'Network timeout', count: 89, percentage: 16.8 },
        { reason: 'Storage quota exceeded', count: 34, percentage: 6.4 },
        { reason: 'Other errors', count: 17, percentage: 3.2 },
      ],
      userActivity: [
        { user: 'john.doe', uploads: 2340, sizeGB: 0.45, successRate: 98.2 },
        { user: 'jane.smith', uploads: 1890, sizeGB: 0.38, successRate: 97.5 },
        { user: 'bob.wilson', uploads: 1456, sizeGB: 0.29, successRate: 96.8 },
        { user: 'alice.johnson', uploads: 1234, sizeGB: 0.25, successRate: 99.1 },
      ],
      recommendations: [
        'Implement file compression for large uploads to reduce storage usage',
        'Add support for more file formats to reduce unsupported format errors',
        'Optimize network timeout settings for better reliability',
        'Consider implementing chunked uploads for large files',
        'Set up storage quota alerts to prevent quota exceeded errors',
      ],
    };

    if (format === 'json') {
      return JSON.stringify(uploadData, null, 2);
    } else if (format === 'csv') {
      return generateUploadReportCSV(uploadData);
    } else if (format === 'xlsx') {
      return generateUploadReportExcel(uploadData);
    } else if (format === 'pdf') {
      return generateUploadReportPDF(uploadData);
    } else {
      return generateUploadReportText(uploadData);
    }
  }

  function generateUploadReportCSV(uploadData) {
    let csv = `UPLOAD ACTIVITY REPORT - ${uploadData.reportInfo.period}\n`;
    csv += `Generated,${uploadData.reportInfo.generated}\n\n`;

    csv += 'EXECUTIVE SUMMARY\n';
    csv += 'Metric,Value\n';
    csv += `Total Uploads,${uploadData.summary.totalUploads}\n`;
    csv += `Successful Uploads,${uploadData.summary.successfulUploads}\n`;
    csv += `Failed Uploads,${uploadData.summary.failedUploads}\n`;
    csv += `Success Rate,${uploadData.statistics.uploads.successRate}%\n`;
    csv += `Total Size,${uploadData.summary.totalSize} GB\n`;
    csv += `Average Upload Speed,${uploadData.summary.avgUploadSpeed} MB/s\n`;
    csv += `Storage Used,${uploadData.summary.storageUsed} GB\n\n`;

    csv += 'FILE TYPE DISTRIBUTION\n';
    csv += 'Type,Count,Size (GB),Percentage\n';
    uploadData.fileTypes.forEach((fileType) => {
      csv += `${fileType.type},${fileType.count},${fileType.sizeGB},${fileType.percentage}%\n`;
    });
    csv += '\n';

    csv += 'HOURLY ACTIVITY\n';
    csv += 'Hour,Uploads,Size (MB)\n';
    uploadData.hourlyActivity.forEach((activity) => {
      csv += `${activity.hour},${activity.uploads},${activity.sizeMB}\n`;
    });
    csv += '\n';

    csv += 'FAILED UPLOAD ANALYSIS\n';
    csv += 'Reason,Count,Percentage\n';
    uploadData.failedUploads.forEach((failure) => {
      csv += `${failure.reason},${failure.count},${failure.percentage}%\n`;
    });

    return csv;
  }

  function generateUploadReportPDF(uploadData) {
    let pdf = `
UPLOAD ACTIVITY REPORT
======================
Generated: ${uploadData.reportInfo.generated}
Report Period: ${uploadData.reportInfo.period}
Export Format: ${uploadData.reportInfo.format}

EXECUTIVE SUMMARY
-----------------
Total Uploads: ${uploadData.summary.totalUploads.toLocaleString()}
Successful Uploads: ${uploadData.summary.successfulUploads.toLocaleString()}
Failed Uploads: ${uploadData.summary.failedUploads}
Success Rate: ${uploadData.statistics.uploads.successRate}%
Total Size: ${uploadData.summary.totalSize} GB
Average Upload Speed: ${uploadData.summary.avgUploadSpeed} MB/s
Peak Upload Speed: ${uploadData.summary.peakUploadSpeed} MB/s
Storage Used: ${uploadData.summary.storageUsed} GB

DETAILED STATISTICS
-------------------

Upload Performance:
- Total Uploads: ${uploadData.statistics.uploads.total.toLocaleString()}
- Successful: ${uploadData.statistics.uploads.successful.toLocaleString()}
- Failed: ${uploadData.statistics.uploads.failed}
- Success Rate: ${uploadData.statistics.uploads.successRate}%

File Size Analysis:
- Total Size: ${uploadData.statistics.size.totalSizeGB} GB
- Average Size: ${uploadData.statistics.size.avgSizeMB} MB
- Largest File: ${uploadData.statistics.size.largestFileMB} MB
- Smallest File: ${uploadData.statistics.size.smallestFileKB} KB

Upload Speed Metrics:
- Average Speed: ${uploadData.statistics.speed.avgSpeedMBps} MB/s
- Peak Speed: ${uploadData.statistics.speed.peakSpeedMBps} MB/s
- Minimum Speed: ${uploadData.statistics.speed.minSpeedMBps} MB/s
- Average Upload Time: ${uploadData.statistics.speed.avgUploadTimeSec} seconds

Storage Utilization:
- Used Space: ${uploadData.statistics.storage.usedGB} GB
- Available Space: ${uploadData.statistics.storage.availableGB} GB
- Total Capacity: ${uploadData.statistics.storage.totalGB} GB
- Utilization: ${uploadData.statistics.storage.utilizationPercent}%

FILE TYPE DISTRIBUTION
----------------------
`;
    uploadData.fileTypes.forEach((fileType) => {
      pdf += `
${fileType.type}:
  Count: ${fileType.count.toLocaleString()} files
  Size: ${fileType.sizeGB} GB
  Percentage: ${fileType.percentage}%
`;
    });

    pdf += `
HOURLY ACTIVITY PATTERNS
------------------------
`;
    uploadData.hourlyActivity.forEach((activity) => {
      pdf += `
${activity.hour}: ${activity.uploads} uploads (${activity.sizeMB} MB)
`;
    });

    pdf += `
USER ACTIVITY
-------------
`;
    uploadData.userActivity.forEach((user) => {
      pdf += `
${user.user}:
  Uploads: ${user.uploads}
  Size: ${user.sizeGB} GB
  Success Rate: ${user.successRate}%
`;
    });

    pdf += `
FAILED UPLOAD ANALYSIS
----------------------
`;
    uploadData.failedUploads.forEach((failure) => {
      pdf += `
${failure.reason}: ${failure.count} (${failure.percentage}%)
`;
    });

    pdf += `
RECOMMENDATIONS
---------------
`;
    uploadData.recommendations.forEach((rec, index) => {
      pdf += `${index + 1}. ${rec}\n`;
    });

    pdf += `
Generated: ${uploadData.reportInfo.generated}
`;

    return pdf;
  }

  function generateUploadReportExcel(uploadData) {
    let html = `
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Upload Activity Report</title>
      <style>
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #667eea; color: white; font-weight: bold; }
        .section-header { background-color: #4CAF50; color: white; font-weight: bold; font-size: 16px; padding: 10px; }
        .summary-cell { background-color: #e3f2fd; font-weight: bold; }
        .high-success { background-color: #c8e6c9; }
        .medium-success { background-color: #fff9c4; }
        .low-success { background-color: #ffcdd2; }
        h1 { color: #333; }
        h2 { color: #667eea; margin-top: 30px; }
      </style>
    </head>
    <body>
      <h1>Upload Activity Report</h1>
      <p><strong>Generated:</strong> ${uploadData.reportInfo.generated} | <strong>Period:</strong> ${uploadData.reportInfo.period}</p>

      <h2>Executive Summary</h2>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td class="summary-cell">Total Uploads</td><td>${uploadData.summary.totalUploads.toLocaleString()}</td></tr>
        <tr><td class="summary-cell">Successful Uploads</td><td>${uploadData.summary.successfulUploads.toLocaleString()}</td></tr>
        <tr><td class="summary-cell">Failed Uploads</td><td>${uploadData.summary.failedUploads}</td></tr>
        <tr><td class="summary-cell">Success Rate</td><td>${uploadData.statistics.uploads.successRate}%</td></tr>
        <tr><td class="summary-cell">Total Size</td><td>${uploadData.summary.totalSize} GB</td></tr>
        <tr><td class="summary-cell">Average Upload Speed</td><td>${uploadData.summary.avgUploadSpeed} MB/s</td></tr>
        <tr><td class="summary-cell">Storage Used</td><td>${uploadData.summary.storageUsed} GB</td></tr>
      </table>

      <h2>Detailed Statistics</h2>
      <table>
        <tr><th>Category</th><th>Metric</th><th>Value</th></tr>
        <tr><td rowspan="4">Upload Performance</td><td>Total Uploads</td><td>${uploadData.statistics.uploads.total.toLocaleString()}</td></tr>
        <tr><td>Successful</td><td>${uploadData.statistics.uploads.successful.toLocaleString()}</td></tr>
        <tr><td>Failed</td><td>${uploadData.statistics.uploads.failed}</td></tr>
        <tr><td>Success Rate</td><td>${uploadData.statistics.uploads.successRate}%</td></tr>
        <tr><td rowspan="4">File Size Analysis</td><td>Total Size</td><td>${uploadData.statistics.size.totalSizeGB} GB</td></tr>
        <tr><td>Average Size</td><td>${uploadData.statistics.size.avgSizeMB} MB</td></tr>
        <tr><td>Largest File</td><td>${uploadData.statistics.size.largestFileMB} MB</td></tr>
        <tr><td>Smallest File</td><td>${uploadData.statistics.size.smallestFileKB} KB</td></tr>
        <tr><td rowspan="4">Upload Speed Metrics</td><td>Average Speed</td><td>${uploadData.statistics.speed.avgSpeedMBps} MB/s</td></tr>
        <tr><td>Peak Speed</td><td>${uploadData.statistics.speed.peakSpeedMBps} MB/s</td></tr>
        <tr><td>Minimum Speed</td><td>${uploadData.statistics.speed.minSpeedMBps} MB/s</td></tr>
        <tr><td>Average Upload Time</td><td>${uploadData.statistics.speed.avgUploadTimeSec} seconds</td></tr>
        <tr><td rowspan="4">Storage Utilization</td><td>Used Space</td><td>${uploadData.statistics.storage.usedGB} GB</td></tr>
        <tr><td>Available Space</td><td>${uploadData.statistics.storage.availableGB} GB</td></tr>
        <tr><td>Total Capacity</td><td>${uploadData.statistics.storage.totalGB} GB</td></tr>
        <tr><td>Utilization</td><td>${uploadData.statistics.storage.utilizationPercent}%</td></tr>
      </table>

      <h2>File Type Distribution</h2>
      <table>
        <tr><th>Type</th><th>Count</th><th>Size (GB)</th><th>Percentage</th></tr>
`;

    uploadData.fileTypes.forEach((fileType) => {
      html += `<tr>
        <td>${fileType.type}</td>
        <td>${fileType.count.toLocaleString()}</td>
        <td>${fileType.sizeGB}</td>
        <td>${fileType.percentage}%</td>
      </tr>`;
    });

    html += `</table>

      <h2>Hourly Activity Patterns</h2>
      <table>
        <tr><th>Hour</th><th>Uploads</th><th>Size (MB)</th></tr>
`;

    uploadData.hourlyActivity.forEach((activity) => {
      html += `<tr>
        <td>${activity.hour}</td>
        <td>${activity.uploads}</td>
        <td>${activity.sizeMB}</td>
      </tr>`;
    });

    html += `</table>

      <h2>User Activity</h2>
      <table>
        <tr><th>User</th><th>Uploads</th><th>Size (GB)</th><th>Success Rate</th></tr>
`;

    uploadData.userActivity.forEach((user) => {
      const successClass =
        user.successRate >= 98
          ? 'high-success'
          : user.successRate >= 95
            ? 'medium-success'
            : 'low-success';
      html += `<tr class="${successClass}">
        <td>${user.user}</td>
        <td>${user.uploads}</td>
        <td>${user.sizeGB}</td>
        <td>${user.successRate}%</td>
      </tr>`;
    });

    html += `</table>

      <h2>Failed Upload Analysis</h2>
      <table>
        <tr><th>Reason</th><th>Count</th><th>Percentage</th></tr>
`;

    uploadData.failedUploads.forEach((failure) => {
      html += `<tr>
        <td>${failure.reason}</td>
        <td>${failure.count}</td>
        <td>${failure.percentage}%</td>
      </tr>`;
    });

    html += `</table>

      <h2>Recommendations</h2>
      <table>
        <tr><th>#</th><th>Recommendation</th></tr>
`;

    uploadData.recommendations.forEach((rec, index) => {
      html += `<tr>
        <td>${index + 1}</td>
        <td>${rec}</td>
      </tr>`;
    });

    html += `</table>
    </body>
    </html>
  `;

    return html;
  }

  function generateUploadReportText(uploadData) {
    return `
UPLOAD ACTIVITY REPORT
======================
Generated: ${uploadData.reportInfo.generated}
Report Period: ${uploadData.reportInfo.period}

EXECUTIVE SUMMARY
-----------------
Total Uploads: ${uploadData.summary.totalUploads.toLocaleString()}
Success Rate: ${uploadData.statistics.uploads.successRate}%
Total Size: ${uploadData.summary.totalSize} GB

FILE TYPE DISTRIBUTION
----------------------
${uploadData.fileTypes.map((type) => `${type.type}: ${type.count} files`).join('\n')}

RECOMMENDATIONS
---------------
${uploadData.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

Generated: ${uploadData.reportInfo.generated}
        `.trim();
  }

  // Export Debug Report function
  function exportDebugReport() {
    console.log('Exporting debug report...');

    // Create debug export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'debug-export-modal';
    exportModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">🐛 Export Debug Report</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Export Format</label>
                    <select id="debug-export-format" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="txt">Text Log</option>
                        <option value="pdf">PDF Report</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Log Level</label>
                    <select id="debug-log-level" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="all">All Levels</option>
                        <option value="error">Errors Only</option>
                        <option value="warning">Warnings & Errors</option>
                        <option value="info">Info & Above</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Time Range</label>
                <select id="debug-time-range" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                    <option value="1">Last Hour</option>
                    <option value="6">Last 6 Hours</option>
                    <option value="24">Last 24 Hours</option>
                    <option value="168">Last Week</option>
                    <option value="720">Last Month</option>
                </select>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Include Information</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Error Logs
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        System Logs
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Performance Metrics
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Stack Traces
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Network Requests
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Browser Console
                    </label>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: flex; align-items: center; color: var(--text-secondary);">
                    <input type="checkbox" checked style="margin-right: 0.5rem;">
                    Include system environment and configuration details
                </label>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeDebugExportModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="processDebugExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Export Report
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeDebugExportModal();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeDebugExportModal() {
    const modal = document.getElementById('debug-export-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function processDebugExport() {
    const format = document.getElementById('debug-export-format').value;
    const logLevel = document.getElementById('debug-log-level').value;
    const timeRange = document.getElementById('debug-time-range').value;

    // Show progress
    const progressModal = document.createElement('div');
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; text-align: center;">
            <div style="width: 100%; height: 8px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 1rem; overflow: hidden;">
                <div id="debug-export-bar" style="height: 100%; background: var(--primary-color); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="debug-export-progress" style="color: var(--text-primary); font-weight: 500;">0%</div>
            <div id="debug-export-status" style="color: var(--text-secondary); margin-top: 0.5rem;">Collecting debug information...</div>
        </div>
    `;

    document.body.appendChild(progressModal);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          closeDebugExportModal();

          // Generate content based on format
          const content = generateDebugReportContent(format, logLevel, timeRange);
          let filename, mimeType;

          if (format === 'json') {
            filename = `debug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            mimeType = 'application/json';
          } else if (format === 'csv') {
            filename = `debug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            mimeType = 'text/csv';
          } else if (format === 'pdf') {
            filename = `debug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
            mimeType = 'application/pdf';
          } else {
            filename = `debug-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            mimeType = 'text/plain';
          }

          // Download the file
          downloadExportContent(content, filename, mimeType);
          showNotification('Debug report exported successfully!', 'success');
        }, 500);
      }

      document.getElementById('debug-export-bar').style.width = progress + '%';
      document.getElementById('debug-export-progress').textContent = Math.round(progress) + '%';

      const statusElement = document.getElementById('debug-export-status');
      if (progress < 20) {
        statusElement.textContent = 'Collecting error logs...';
      } else if (progress < 40) {
        statusElement.textContent = 'Analyzing system logs...';
      } else if (progress < 60) {
        statusElement.textContent = 'Processing performance metrics...';
      } else if (progress < 80) {
        statusElement.textContent = 'Compiling stack traces...';
      } else {
        statusElement.textContent = 'Finalizing debug report...';
      }
    }, 350);
  }

  function generateDebugReportContent(format, logLevel, timeRange) {
    const timestamp = new Date().toLocaleString();
    const rangeText =
      timeRange === '1'
        ? '1 Hour'
        : timeRange === '6'
          ? '6 Hours'
          : timeRange === '24'
            ? '24 Hours'
            : timeRange === '168'
              ? '1 Week'
              : '1 Month';
    const levelText =
      logLevel === 'all'
        ? 'All Levels'
        : logLevel === 'error'
          ? 'Errors Only'
          : logLevel === 'warning'
            ? 'Warnings & Errors'
            : 'Info & Above';

    const debugData = {
      reportInfo: {
        title: 'Debug Analysis Report',
        generated: timestamp,
        logLevel: levelText,
        timeRange: rangeText,
        format: format.toUpperCase(),
      },
      systemInfo: {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory || 'N/A',
      },
      performance: {
        loadTime: performance.timing.loadEnd - performance.timing.navigationStart,
        domContentLoaded:
          performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0,
        totalResources: performance.getEntriesByType('resource').length,
        memoryUsage: performance.memory
          ? {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
              jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
            }
          : null,
      },
      errors: [
        {
          timestamp: '2024-05-20T14:30:15.234Z',
          level: 'error',
          message: "TypeError: Cannot read property 'length' of undefined",
          source: 'dashboard-scripts.js:1250',
          stack:
            "TypeError: Cannot read property 'length' of undefined\\n    at processData (dashboard-scripts.js:1250:15)\\n    at handleDataUpdate (dashboard-scripts.js:1120:8)\\n    at XMLHttpRequest.onload (dashboard-scripts.js:980:12)",
          userAgent: navigator.userAgent,
        },
        {
          timestamp: '2024-05-20T14:25:42.891Z',
          level: 'warning',
          message: 'DeprecationWarning: XMLHttpRequest is deprecated',
          source: 'api-client.js:340',
          stack:
            'DeprecationWarning: XMLHttpRequest is deprecated\\n    at makeRequest (api-client.js:340:20)',
          userAgent: navigator.userAgent,
        },
        {
          timestamp: '2024-05-20T14:18:33.120Z',
          level: 'error',
          message: 'NetworkError: Failed to fetch',
          source: 'data-loader.js:567',
          stack:
            'NetworkError: Failed to fetch\\n    at loadData (data-loader.js:567:18)\\n    at refreshDashboard (dashboard-init.js:234:12)',
          userAgent: navigator.userAgent,
        },
      ],
      networkRequests: [
        {
          url: '/api/dashboard/data',
          method: 'GET',
          status: 200,
          responseTime: 245,
          size: 15420,
          timestamp: '2024-05-20T14:30:12.456Z',
        },
        {
          url: '/api/analytics/metrics',
          method: 'POST',
          status: 500,
          responseTime: 1200,
          size: 0,
          timestamp: '2024-05-20T14:28:45.789Z',
        },
        {
          url: '/api/user/profile',
          method: 'GET',
          status: 200,
          responseTime: 180,
          size: 2340,
          timestamp: '2024-05-20T14:25:30.123Z',
        },
      ],
      consoleLogs: [
        {
          timestamp: '2024-05-20T14:30:15.234Z',
          level: 'error',
          message: 'Dashboard data processing failed',
          source: 'dashboard-scripts.js:1250',
        },
        {
          timestamp: '2024-05-20T14:29:45.678Z',
          level: 'warn',
          message: 'Slow API response detected',
          source: 'api-client.js:340',
        },
        {
          timestamp: '2024-05-20T14:28:12.345Z',
          level: 'info',
          message: 'Dashboard initialized successfully',
          source: 'dashboard-init.js:50',
        },
      ],
      browserInfo: {
        appName: navigator.appName,
        appVersion: navigator.appVersion,
        vendor: navigator.vendor,
        product: navigator.product,
        javaEnabled: navigator.javaEnabled(),
        pdfViewerEnabled: navigator.pdfViewerEnabled,
        permissions: {
          geolocation: 'prompt',
          notifications: 'granted',
          camera: 'denied',
          microphone: 'denied',
        },
      },
      storageInfo: {
        localStorage: {
          used: new Blob([JSON.stringify(localStorage)]).size,
          available: 5 * 1024 * 1024, // 5MB typical limit
        },
        sessionStorage: {
          used: new Blob([JSON.stringify(sessionStorage)]).size,
          available: 5 * 1024 * 1024, // 5MB typical limit
        },
        cookies: document.cookie.length,
      },
      recommendations: [
        'Fix undefined property access in processData function',
        'Replace deprecated XMLHttpRequest with fetch API',
        'Implement proper error handling for network requests',
        'Add retry mechanism for failed API calls',
        'Optimize API response times for better performance',
        'Review memory usage patterns for potential leaks',
        'Implement proper error logging and monitoring',
      ],
    };

    if (format === 'json') {
      return JSON.stringify(debugData, null, 2);
    } else if (format === 'csv') {
      return generateDebugReportCSV(debugData);
    } else if (format === 'pdf') {
      return generateDebugReportPDF(debugData);
    } else {
      return generateDebugReportText(debugData);
    }
  }

  function generateDebugReportCSV(debugData) {
    let csv = `DEBUG ANALYSIS REPORT - ${debugData.reportInfo.timeRange}\n`;
    csv += `Generated,${debugData.reportInfo.generated}\n`;
    csv += `Log Level,${debugData.reportInfo.logLevel}\n\n`;

    csv += 'SYSTEM INFORMATION\n';
    csv += `Platform,${debugData.systemInfo.platform}\n`;
    csv += `User Agent,${debugData.systemInfo.userAgent}\n`;
    csv += `Language,${debugData.systemInfo.language}\n`;
    csv += `Screen Resolution,${debugData.systemInfo.screenResolution}\n`;
    csv += `CPU Cores,${debugData.systemInfo.hardwareConcurrency}\n\n`;

    csv += 'ERROR LOGS\n';
    csv += 'Timestamp,Level,Message,Source\n';
    debugData.errors.forEach((error) => {
      csv += `"${error.timestamp}","${error.level}","${error.message}","${error.source}"\n`;
    });
    csv += '\n';

    csv += 'NETWORK REQUESTS\n';
    csv += 'Timestamp,Method,URL,Status,Response Time,Size\n';
    debugData.networkRequests.forEach((req) => {
      csv += `"${req.timestamp}","${req.method}","${req.url}",${req.status},${req.responseTime},${req.size}\n`;
    });
    csv += '\n';

    csv += 'CONSOLE LOGS\n';
    csv += 'Timestamp,Level,Message,Source\n';
    debugData.consoleLogs.forEach((log) => {
      csv += `"${log.timestamp}","${log.level}","${log.message}","${log.source}"\n`;
    });

    return csv;
  }

  function generateDebugReportPDF(debugData) {
    let pdf = `
DEBUG ANALYSIS REPORT
======================
Generated: ${debugData.reportInfo.generated}
Report Period: ${debugData.reportInfo.timeRange}
Log Level: ${debugData.reportInfo.logLevel}
Export Format: ${debugData.reportInfo.format}

SYSTEM INFORMATION
------------------
Platform: ${debugData.systemInfo.platform}
User Agent: ${debugData.systemInfo.userAgent}
Language: ${debugData.systemInfo.language}
Cookies Enabled: ${debugData.systemInfo.cookieEnabled}
Online Status: ${debugData.systemInfo.onLine}
Screen Resolution: ${debugData.systemInfo.screenResolution}
Color Depth: ${debugData.systemInfo.colorDepth} bits
Timezone: ${debugData.systemInfo.timezone}
CPU Cores: ${debugData.systemInfo.hardwareConcurrency}
Device Memory: ${debugData.systemInfo.deviceMemory} GB

BROWSER INFORMATION
-------------------
App Name: ${debugData.browserInfo.appName}
App Version: ${debugData.browserInfo.appVersion}
Vendor: ${debugData.browserInfo.vendor}
Product: ${debugData.browserInfo.product}
Java Enabled: ${debugData.browserInfo.javaEnabled}
PDF Viewer Enabled: ${debugData.browserInfo.pdfViewerEnabled}

Permissions:
- Geolocation: ${debugData.browserInfo.permissions.geolocation}
- Notifications: ${debugData.browserInfo.permissions.notifications}
- Camera: ${debugData.browserInfo.permissions.camera}
- Microphone: ${debugData.browserInfo.permissions.microphone}

STORAGE INFORMATION
-------------------
Local Storage: ${debugData.storageInfo.localStorage.used} bytes used / ${debugData.storageInfo.localStorage.available} bytes available
Session Storage: ${debugData.storageInfo.sessionStorage.used} bytes used / ${debugData.storageInfo.sessionStorage.available} bytes available
Cookies: ${debugData.storageInfo.cookies} characters

PERFORMANCE METRICS
-------------------
Page Load Time: ${debugData.performance.loadTime}ms
DOM Content Loaded: ${debugData.performance.domContentLoaded}ms
First Paint: ${debugData.performance.firstPaint}ms
First Contentful Paint: ${debugData.performance.firstContentfulPaint}ms
Total Resources: ${debugData.performance.totalResources}
${
  debugData.performance.memoryUsage
    ? `
Memory Usage:
- Used JS Heap: ${(debugData.performance.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
- Total JS Heap: ${(debugData.performance.memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
- JS Heap Limit: ${(debugData.performance.memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
`
    : ''
}

ERROR LOGS
----------
`;
    debugData.errors.forEach((error) => {
      pdf += `
[${error.timestamp}] ${error.level.toUpperCase()}
Message: ${error.message}
Source: ${error.source}
Stack Trace:
${error.stack}
---
`;
    });

    pdf += `
NETWORK REQUESTS
----------------
`;
    debugData.networkRequests.forEach((req) => {
      pdf += `
[${req.timestamp}] ${req.method} ${req.url}
Status: ${req.status}
Response Time: ${req.responseTime}ms
Size: ${req.size} bytes
---
`;
    });

    pdf += `
CONSOLE LOGS
------------
`;
    debugData.consoleLogs.forEach((log) => {
      pdf += `
[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}
Source: ${log.source}
`;
    });

    pdf += `
RECOMMENDATIONS
---------------
`;
    debugData.recommendations.forEach((rec, index) => {
      pdf += `${index + 1}. ${rec}\n`;
    });

    pdf += `
Generated: ${debugData.reportInfo.generated}
`;

    return pdf;
  }

  function generateDebugReportText(debugData) {
    return `
DEBUG ANALYSIS REPORT
======================
Generated: ${debugData.reportInfo.generated}
Report Period: ${debugData.reportInfo.timeRange}
Log Level: ${debugData.reportInfo.logLevel}

SYSTEM INFORMATION
------------------
Platform: ${debugData.systemInfo.platform}
User Agent: ${debugData.systemInfo.userAgent}
ERROR LOGS
----------
${debugData.errors.map((error) => `[${error.timestamp}] ${error.level}: ${error.message}`).join('\n')}

NETWORK REQUESTS
----------------
${debugData.networkRequests.map((req) => `[${req.timestamp}] ${req.method} ${req.url} - ${req.status}`).join('\n')}

RECOMMENDATIONS
---------------
${debugData.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

Generated: ${debugData.reportInfo.generated}
        `.trim();
  }

  // View Milestone Details function
  function viewMilestoneDetails(milestoneId) {
    console.log(`Viewing details for milestone: ${milestoneId}`);

    // Mock milestone data - in a real application, this would come from your data source
    const milestoneData = {
      m1: {
        id: 'm1',
        name: 'Project Initialization',
        description:
          'Initialize project with setup of development environment, version control, and project infrastructure',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'setup',
        created: '2024-01-01T09:00:00Z',
        targetDate: '2024-01-15T18:00:00Z',
        actualCompletion: '2024-01-12T16:45:00Z',
        assignees: ['John Smith', 'Emily Davis', 'Michael Brown'],
        dependencies: [],
        deliverables: [
          {
            id: 'd34',
            name: 'Development Environment Setup',
            status: 'completed',
            completedDate: '2024-01-05T14:00:00Z',
          },
          {
            id: 'd35',
            name: 'Version Control Repository',
            status: 'completed',
            completedDate: '2024-01-08T11:30:00Z',
          },
          {
            id: 'd36',
            name: 'Project Documentation',
            status: 'completed',
            completedDate: '2024-01-12T15:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't45',
            title: 'Set Up Development Tools',
            status: 'completed',
            assignee: 'John Smith',
            dueDate: '2024-01-05T17:00:00Z',
          },
          {
            id: 't46',
            title: 'Initialize Git Repository',
            status: 'completed',
            assignee: 'Emily Davis',
            dueDate: '2024-01-08T17:00:00Z',
          },
          {
            id: 't47',
            title: 'Create Project Structure',
            status: 'completed',
            assignee: 'Michael Brown',
            dueDate: '2024-01-10T17:00:00Z',
          },
          {
            id: 't48',
            title: 'Document Project Requirements',
            status: 'completed',
            assignee: 'John Smith',
            dueDate: '2024-01-12T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r26',
            description: 'Tool compatibility issues',
            severity: 'low',
            status: 'resolved',
          },
          {
            id: 'r27',
            description: 'Team onboarding delays',
            severity: 'medium',
            status: 'mitigated',
          },
        ],
        notes:
          'Successfully established project foundation with all team members onboarded and tools configured.',
      },
      m2: {
        id: 'm2',
        name: 'Database Architecture',
        description:
          'Design and implement database schema, establish data models, and set up database infrastructure',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'infrastructure',
        created: '2024-01-10T08:00:00Z',
        targetDate: '2024-01-25T18:00:00Z',
        actualCompletion: '2024-01-23T14:20:00Z',
        assignees: ['Sarah Wilson', 'David Lee', 'Lisa Chen'],
        dependencies: ['m1'],
        deliverables: [
          {
            id: 'd37',
            name: 'Database Schema Design',
            status: 'completed',
            completedDate: '2024-01-15T16:00:00Z',
          },
          {
            id: 'd38',
            name: 'Data Models Documentation',
            status: 'completed',
            completedDate: '2024-01-18T13:30:00Z',
          },
          {
            id: 'd39',
            name: 'Database Infrastructure',
            status: 'completed',
            completedDate: '2024-01-22T15:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't49',
            title: 'Design Database Schema',
            status: 'completed',
            assignee: 'Sarah Wilson',
            dueDate: '2024-01-15T17:00:00Z',
          },
          {
            id: 't50',
            title: 'Create Data Models',
            status: 'completed',
            assignee: 'David Lee',
            dueDate: '2024-01-18T17:00:00Z',
          },
          {
            id: 't51',
            title: 'Set Up Database Server',
            status: 'completed',
            assignee: 'Lisa Chen',
            dueDate: '2024-01-20T17:00:00Z',
          },
          {
            id: 't52',
            title: 'Implement Backup Strategy',
            status: 'completed',
            assignee: 'Sarah Wilson',
            dueDate: '2024-01-23T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r28',
            description: 'Data integrity issues',
            severity: 'high',
            status: 'prevented',
          },
          {
            id: 'r29',
            description: 'Performance bottlenecks',
            severity: 'medium',
            status: 'optimized',
          },
        ],
        notes: 'Database architecture supports 1M+ records with sub-second query performance.',
      },
      m3: {
        id: 'm3',
        name: 'Backend Infrastructure',
        description:
          'Establish backend infrastructure including server setup, microservices architecture, and deployment pipelines',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'infrastructure',
        created: '2024-01-15T09:00:00Z',
        targetDate: '2024-02-05T18:00:00Z',
        actualCompletion: '2024-02-02T16:30:00Z',
        assignees: ['Robert Johnson', 'Amanda White', 'Chris Martinez'],
        dependencies: ['m2'],
        deliverables: [
          {
            id: 'd40',
            name: 'Server Infrastructure',
            status: 'completed',
            completedDate: '2024-01-20T14:00:00Z',
          },
          {
            id: 'd41',
            name: 'Microservices Architecture',
            status: 'completed',
            completedDate: '2024-01-28T11:30:00Z',
          },
          {
            id: 'd42',
            name: 'Deployment Pipeline',
            status: 'completed',
            completedDate: '2024-02-01T15:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't53',
            title: 'Set Up Cloud Infrastructure',
            status: 'completed',
            assignee: 'Robert Johnson',
            dueDate: '2024-01-20T17:00:00Z',
          },
          {
            id: 't54',
            title: 'Design Microservices',
            status: 'completed',
            assignee: 'Amanda White',
            dueDate: '2024-01-25T17:00:00Z',
          },
          {
            id: 't55',
            title: 'Implement CI/CD Pipeline',
            status: 'completed',
            assignee: 'Chris Martinez',
            dueDate: '2024-01-30T17:00:00Z',
          },
          {
            id: 't56',
            title: 'Configure Monitoring',
            status: 'completed',
            assignee: 'Robert Johnson',
            dueDate: '2024-02-02T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r30',
            description: 'Service discovery issues',
            severity: 'medium',
            status: 'resolved',
          },
          { id: 'r31', description: 'Deployment failures', severity: 'high', status: 'mitigated' },
        ],
        notes:
          'Microservices architecture deployed with 99.95% uptime and auto-scaling capabilities.',
      },
      m4: {
        id: 'm4',
        name: 'API Development',
        description: 'Develop comprehensive REST API endpoints for core application functionality',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'feature',
        created: '2024-01-15T09:00:00Z',
        targetDate: '2024-02-28T18:00:00Z',
        actualCompletion: '2024-02-25T16:30:00Z',
        assignees: ['Daniel Kim', 'Jessica Lee', 'Michael Chen'],
        dependencies: ['m3'],
        deliverables: [
          {
            id: 'd19',
            name: 'API Documentation',
            status: 'completed',
            completedDate: '2024-02-10T14:00:00Z',
          },
          {
            id: 'd20',
            name: 'Authentication Endpoints',
            status: 'completed',
            completedDate: '2024-02-15T11:30:00Z',
          },
          {
            id: 'd21',
            name: 'Data Management APIs',
            status: 'completed',
            completedDate: '2024-02-22T15:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't25',
            title: 'Design API Architecture',
            status: 'completed',
            assignee: 'Daniel Kim',
            dueDate: '2024-01-25T17:00:00Z',
          },
          {
            id: 't26',
            title: 'Implement Core Endpoints',
            status: 'completed',
            assignee: 'Jessica Lee',
            dueDate: '2024-02-10T17:00:00Z',
          },
          {
            id: 't27',
            title: 'Add Authentication Layer',
            status: 'completed',
            assignee: 'Michael Chen',
            dueDate: '2024-02-18T17:00:00Z',
          },
          {
            id: 't28',
            title: 'API Testing and Validation',
            status: 'completed',
            assignee: 'Daniel Kim',
            dueDate: '2024-02-25T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r16',
            description: 'API performance bottlenecks',
            severity: 'medium',
            status: 'resolved',
          },
          {
            id: 'r17',
            description: 'Security vulnerabilities',
            severity: 'high',
            status: 'mitigated',
          },
        ],
        notes:
          'Successfully deployed 45 API endpoints with 99.9% uptime. Response times under 100ms.',
      },
      m5: {
        id: 'm5',
        name: 'Testing Framework',
        description:
          'Implement comprehensive testing framework including unit tests, integration tests, and automated testing pipelines',
        status: 'completed',
        progress: 100,
        priority: 'medium',
        type: 'testing',
        created: '2024-02-01T10:00:00Z',
        targetDate: '2024-03-15T18:00:00Z',
        actualCompletion: '2024-03-12T14:20:00Z',
        assignees: ['Rachel Green', 'Thomas White', 'Sarah Black'],
        dependencies: ['m4'],
        deliverables: [
          {
            id: 'd22',
            name: 'Unit Test Suite',
            status: 'completed',
            completedDate: '2024-02-20T16:00:00Z',
          },
          {
            id: 'd23',
            name: 'Integration Tests',
            status: 'completed',
            completedDate: '2024-03-05T11:30:00Z',
          },
          {
            id: 'd24',
            name: 'CI/CD Pipeline',
            status: 'completed',
            completedDate: '2024-03-10T15:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't29',
            title: 'Set Up Testing Environment',
            status: 'completed',
            assignee: 'Rachel Green',
            dueDate: '2024-02-10T17:00:00Z',
          },
          {
            id: 't30',
            title: 'Write Unit Tests',
            status: 'completed',
            assignee: 'Thomas White',
            dueDate: '2024-02-25T17:00:00Z',
          },
          {
            id: 't31',
            title: 'Implement Integration Tests',
            status: 'completed',
            assignee: 'Sarah Black',
            dueDate: '2024-03-05T17:00:00Z',
          },
          {
            id: 't32',
            title: 'Configure CI/CD Pipeline',
            status: 'completed',
            assignee: 'Rachel Green',
            dueDate: '2024-03-12T17:00:00Z',
          },
        ],
        risks: [
          { id: 'r18', description: 'Test coverage gaps', severity: 'medium', status: 'resolved' },
          {
            id: 'r19',
            description: 'Pipeline reliability issues',
            severity: 'low',
            status: 'mitigated',
          },
        ],
        notes: 'Achieved 95% code coverage. Automated testing reduces deployment time by 70%.',
      },
      m6: {
        id: 'm6',
        name: 'User Authentication System',
        description:
          'Implement secure user authentication system with multi-factor authentication and role-based access control',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'feature',
        created: '2024-02-10T08:00:00Z',
        targetDate: '2024-03-20T18:00:00Z',
        actualCompletion: '2024-03-18T10:30:00Z',
        assignees: ['Alex Johnson', 'Maria Rodriguez', 'David Park'],
        dependencies: ['m5'],
        deliverables: [
          {
            id: 'd25',
            name: 'Authentication Module',
            status: 'completed',
            completedDate: '2024-02-28T14:00:00Z',
          },
          {
            id: 'd26',
            name: 'MFA Implementation',
            status: 'completed',
            completedDate: '2024-03-10T13:20:00Z',
          },
          {
            id: 'd27',
            name: 'Role Management System',
            status: 'completed',
            completedDate: '2024-03-15T16:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't33',
            title: 'Design Authentication Flow',
            status: 'completed',
            assignee: 'Alex Johnson',
            dueDate: '2024-02-20T17:00:00Z',
          },
          {
            id: 't34',
            title: 'Implement Core Authentication',
            status: 'completed',
            assignee: 'Maria Rodriguez',
            dueDate: '2024-03-05T17:00:00Z',
          },
          {
            id: 't35',
            title: 'Add Multi-Factor Authentication',
            status: 'completed',
            assignee: 'David Park',
            dueDate: '2024-03-12T17:00:00Z',
          },
          {
            id: 't36',
            title: 'Implement Role-Based Access',
            status: 'completed',
            assignee: 'Alex Johnson',
            dueDate: '2024-03-18T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r20',
            description: 'Authentication bypass vulnerabilities',
            severity: 'high',
            status: 'resolved',
          },
          {
            id: 'r21',
            description: 'User experience complexity',
            severity: 'medium',
            status: 'optimized',
          },
        ],
        notes:
          'Successfully implemented enterprise-grade authentication with 99.99% security rating.',
      },
      m7: {
        id: 'm7',
        name: 'Data Analytics Dashboard',
        description:
          'Create comprehensive analytics dashboard with real-time data visualization and reporting capabilities',
        status: 'completed',
        progress: 100,
        priority: 'medium',
        type: 'feature',
        created: '2024-02-20T09:00:00Z',
        targetDate: '2024-03-25T18:00:00Z',
        actualCompletion: '2024-03-22T16:45:00Z',
        assignees: ['Emily Chen', 'James Wilson', 'Lisa Anderson'],
        dependencies: ['m6'],
        deliverables: [
          {
            id: 'd28',
            name: 'Dashboard UI Components',
            status: 'completed',
            completedDate: '2024-03-05T14:30:00Z',
          },
          {
            id: 'd29',
            name: 'Data Visualization Charts',
            status: 'completed',
            completedDate: '2024-03-15T11:00:00Z',
          },
          {
            id: 'd30',
            name: 'Real-time Data Pipeline',
            status: 'completed',
            completedDate: '2024-03-20T15:20:00Z',
          },
        ],
        tasks: [
          {
            id: 't37',
            title: 'Design Dashboard Layout',
            status: 'completed',
            assignee: 'Emily Chen',
            dueDate: '2024-03-01T17:00:00Z',
          },
          {
            id: 't38',
            title: 'Implement Chart Components',
            status: 'completed',
            assignee: 'James Wilson',
            dueDate: '2024-03-10T17:00:00Z',
          },
          {
            id: 't39',
            title: 'Build Real-time Pipeline',
            status: 'completed',
            assignee: 'Lisa Anderson',
            dueDate: '2024-03-18T17:00:00Z',
          },
          {
            id: 't40',
            title: 'Performance Optimization',
            status: 'completed',
            assignee: 'Emily Chen',
            dueDate: '2024-03-22T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r22',
            description: 'Real-time data performance',
            severity: 'medium',
            status: 'optimized',
          },
          { id: 'r23', description: 'Chart rendering issues', severity: 'low', status: 'resolved' },
        ],
        notes: 'Dashboard handles 10,000 concurrent users with sub-second response times.',
      },
      m8: {
        id: 'm8',
        name: 'Mobile Responsiveness',
        description:
          'Ensure full mobile responsiveness across all application components and optimize touch interactions',
        status: 'completed',
        progress: 100,
        priority: 'medium',
        type: 'feature',
        created: '2024-02-25T10:00:00Z',
        targetDate: '2024-03-30T18:00:00Z',
        actualCompletion: '2024-03-28T14:15:00Z',
        assignees: ['Kevin Zhang', 'Amy Liu', 'Brian Martinez'],
        dependencies: ['m7'],
        deliverables: [
          {
            id: 'd31',
            name: 'Mobile CSS Framework',
            status: 'completed',
            completedDate: '2024-03-08T16:00:00Z',
          },
          {
            id: 'd32',
            name: 'Touch-Optimized Components',
            status: 'completed',
            completedDate: '2024-03-18T13:30:00Z',
          },
          {
            id: 'd33',
            name: 'Mobile Testing Suite',
            status: 'completed',
            completedDate: '2024-03-25T15:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't41',
            title: 'Audit Mobile Compatibility',
            status: 'completed',
            assignee: 'Kevin Zhang',
            dueDate: '2024-03-05T17:00:00Z',
          },
          {
            id: 't42',
            title: 'Implement Responsive Design',
            status: 'completed',
            assignee: 'Amy Liu',
            dueDate: '2024-03-15T17:00:00Z',
          },
          {
            id: 't43',
            title: 'Optimize Touch Interactions',
            status: 'completed',
            assignee: 'Brian Martinez',
            dueDate: '2024-03-22T17:00:00Z',
          },
          {
            id: 't44',
            title: 'Cross-Device Testing',
            status: 'completed',
            assignee: 'Kevin Zhang',
            dueDate: '2024-03-28T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r24',
            description: 'Cross-browser compatibility',
            severity: 'medium',
            status: 'resolved',
          },
          { id: 'r25', description: 'Touch gesture conflicts', severity: 'low', status: 'fixed' },
        ],
        notes: 'Achieved 100% mobile compatibility across all major devices and browsers.',
      },
      m9: {
        id: 'm9',
        name: 'Frontend Redesign',
        description:
          'Complete redesign of the user interface with modern design system and improved user experience',
        status: 'completed',
        progress: 100,
        priority: 'medium',
        type: 'feature',
        created: '2024-03-01T10:00:00Z',
        targetDate: '2024-04-15T18:00:00Z',
        actualCompletion: '2024-04-12T14:20:00Z',
        assignees: ['Emma Davis', 'Oliver Wilson', 'Sophia Martinez'],
        dependencies: ['m8'],
        deliverables: [
          {
            id: 'd10',
            name: 'Design System Components',
            status: 'completed',
            completedDate: '2024-03-20T16:00:00Z',
          },
          {
            id: 'd11',
            name: 'Responsive Layouts',
            status: 'completed',
            completedDate: '2024-04-05T11:30:00Z',
          },
          {
            id: 'd12',
            name: 'User Testing Reports',
            status: 'completed',
            completedDate: '2024-04-10T15:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't13',
            title: 'Create Design System',
            status: 'completed',
            assignee: 'Emma Davis',
            dueDate: '2024-03-20T17:00:00Z',
          },
          {
            id: 't14',
            title: 'Implement Responsive Design',
            status: 'completed',
            assignee: 'Oliver Wilson',
            dueDate: '2024-04-05T17:00:00Z',
          },
          {
            id: 't15',
            title: 'Conduct User Testing',
            status: 'completed',
            assignee: 'Sophia Martinez',
            dueDate: '2024-04-08T17:00:00Z',
          },
          {
            id: 't16',
            title: 'Finalize UI Components',
            status: 'completed',
            assignee: 'Emma Davis',
            dueDate: '2024-04-12T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r9',
            description: 'Browser compatibility issues',
            severity: 'medium',
            status: 'resolved',
          },
          {
            id: 'r10',
            description: 'User adoption resistance',
            severity: 'low',
            status: 'mitigated',
          },
        ],
        notes:
          'Successfully launched new UI with positive user feedback. 95% user satisfaction rating achieved.',
      },
      m10: {
        id: 'm10',
        name: 'Performance Optimization',
        description:
          'Optimize application performance including load times, database queries, and resource utilization',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'feature',
        created: '2024-03-15T09:00:00Z',
        targetDate: '2024-04-20T18:00:00Z',
        actualCompletion: '2024-04-18T10:30:00Z',
        assignees: ['Ryan Cooper', 'Ava Thompson', 'Noah Johnson'],
        dependencies: ['m9'],
        deliverables: [
          {
            id: 'd13',
            name: 'Database Optimization Scripts',
            status: 'completed',
            completedDate: '2024-03-28T14:00:00Z',
          },
          {
            id: 'd14',
            name: 'Caching Implementation',
            status: 'completed',
            completedDate: '2024-04-10T13:20:00Z',
          },
          {
            id: 'd15',
            name: 'Performance Benchmarks',
            status: 'completed',
            completedDate: '2024-04-17T16:45:00Z',
          },
        ],
        tasks: [
          {
            id: 't17',
            title: 'Analyze Performance Bottlenecks',
            status: 'completed',
            assignee: 'Ryan Cooper',
            dueDate: '2024-03-22T17:00:00Z',
          },
          {
            id: 't18',
            title: 'Optimize Database Queries',
            status: 'completed',
            assignee: 'Ava Thompson',
            dueDate: '2024-04-05T17:00:00Z',
          },
          {
            id: 't19',
            title: 'Implement Caching Strategy',
            status: 'completed',
            assignee: 'Noah Johnson',
            dueDate: '2024-04-12T17:00:00Z',
          },
          {
            id: 't20',
            title: 'Load Testing and Validation',
            status: 'completed',
            assignee: 'Ryan Cooper',
            dueDate: '2024-04-18T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r11',
            description: 'Performance regression',
            severity: 'medium',
            status: 'avoided',
          },
          {
            id: 'r12',
            description: 'Cache invalidation issues',
            severity: 'low',
            status: 'resolved',
          },
        ],
        notes: 'Achieved 60% improvement in load times and 40% reduction in server resource usage.',
      },
      m11: {
        id: 'm11',
        name: 'Security Audit',
        description:
          'Comprehensive security audit including vulnerability assessment, penetration testing, and security fixes',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'testing',
        created: '2024-04-01T08:00:00Z',
        targetDate: '2024-04-25T18:00:00Z',
        actualCompletion: '2024-04-23T16:45:00Z',
        assignees: ['Isabella Brown', 'Lucas Garcia', 'Mia Anderson'],
        dependencies: ['m10'],
        deliverables: [
          {
            id: 'd16',
            name: 'Vulnerability Assessment Report',
            status: 'completed',
            completedDate: '2024-04-08T14:30:00Z',
          },
          {
            id: 'd17',
            name: 'Penetration Testing Results',
            status: 'completed',
            completedDate: '2024-04-15T11:00:00Z',
          },
          {
            id: 'd18',
            name: 'Security Fixes Documentation',
            status: 'completed',
            completedDate: '2024-04-22T15:20:00Z',
          },
        ],
        tasks: [
          {
            id: 't21',
            title: 'Conduct Vulnerability Assessment',
            status: 'completed',
            assignee: 'Isabella Brown',
            dueDate: '2024-04-08T17:00:00Z',
          },
          {
            id: 't22',
            title: 'Perform Penetration Testing',
            status: 'completed',
            assignee: 'Lucas Garcia',
            dueDate: '2024-04-15T17:00:00Z',
          },
          {
            id: 't23',
            title: 'Implement Security Fixes',
            status: 'completed',
            assignee: 'Mia Anderson',
            dueDate: '2024-04-20T17:00:00Z',
          },
          {
            id: 't24',
            title: 'Final Security Validation',
            status: 'completed',
            assignee: 'Isabella Brown',
            dueDate: '2024-04-23T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r13',
            description: 'Critical vulnerabilities found',
            severity: 'high',
            status: 'resolved',
          },
          { id: 'r14', description: 'Compliance issues', severity: 'medium', status: 'addressed' },
          {
            id: 'r15',
            description: 'Third-party dependencies',
            severity: 'low',
            status: 'updated',
          },
        ],
        notes:
          'All critical vulnerabilities resolved. System now meets industry security standards.',
      },
      m12: {
        id: 'm12',
        name: 'Database Migration Complete',
        description:
          'Complete migration from legacy database system to new cloud-based infrastructure',
        status: 'completed',
        progress: 100,
        priority: 'high',
        type: 'release',
        created: '2024-04-15T09:00:00Z',
        targetDate: '2024-05-01T18:00:00Z',
        actualCompletion: '2024-04-28T16:30:00Z',
        assignees: ['Sarah Chen', 'Mike Johnson', 'Lisa Wang'],
        dependencies: ['m10', 'm11'],
        deliverables: [
          {
            id: 'd1',
            name: 'Migration Scripts',
            status: 'completed',
            completedDate: '2024-04-20T14:00:00Z',
          },
          {
            id: 'd2',
            name: 'Data Validation Reports',
            status: 'completed',
            completedDate: '2024-04-25T11:30:00Z',
          },
          {
            id: 'd3',
            name: 'Performance Benchmarks',
            status: 'completed',
            completedDate: '2024-04-27T09:15:00Z',
          },
        ],
        tasks: [
          {
            id: 't1',
            title: 'Backup Legacy Database',
            status: 'completed',
            assignee: 'Sarah Chen',
            dueDate: '2024-04-18T17:00:00Z',
          },
          {
            id: 't2',
            title: 'Create Migration Scripts',
            status: 'completed',
            assignee: 'Mike Johnson',
            dueDate: '2024-04-22T17:00:00Z',
          },
          {
            id: 't3',
            title: 'Test Migration Process',
            status: 'completed',
            assignee: 'Lisa Wang',
            dueDate: '2024-04-25T17:00:00Z',
          },
          {
            id: 't4',
            title: 'Execute Production Migration',
            status: 'completed',
            assignee: 'Sarah Chen',
            dueDate: '2024-04-28T12:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r1',
            description: 'Data corruption during migration',
            severity: 'high',
            status: 'mitigated',
          },
          {
            id: 'r2',
            description: 'Performance degradation',
            severity: 'medium',
            status: 'resolved',
          },
          { id: 'r3', description: 'Extended downtime', severity: 'high', status: 'avoided' },
        ],
        notes:
          'Successfully migrated 2.5TB of data with zero data loss. Performance improved by 35%.',
      },
      m13: {
        id: 'm13',
        name: 'API Security Enhancement',
        description:
          'Implement comprehensive security measures for all API endpoints including authentication, authorization, and rate limiting',
        status: 'in-progress',
        progress: 75,
        priority: 'high',
        type: 'feature',
        created: '2024-04-20T10:00:00Z',
        targetDate: '2024-05-20T18:00:00Z',
        assignees: ['David Park', 'Emily Rodriguez', 'James Wilson'],
        dependencies: ['m12'],
        deliverables: [
          {
            id: 'd4',
            name: 'Security Audit Report',
            status: 'completed',
            completedDate: '2024-04-25T15:00:00Z',
          },
          {
            id: 'd5',
            name: 'Authentication System',
            status: 'completed',
            completedDate: '2024-05-02T13:45:00Z',
          },
          {
            id: 'd6',
            name: 'Rate Limiting Implementation',
            status: 'in-progress',
            completedDate: null,
          },
        ],
        tasks: [
          {
            id: 't5',
            title: 'Conduct Security Audit',
            status: 'completed',
            assignee: 'David Park',
            dueDate: '2024-04-25T17:00:00Z',
          },
          {
            id: 't6',
            title: 'Implement OAuth 2.0',
            status: 'completed',
            assignee: 'Emily Rodriguez',
            dueDate: '2024-05-01T17:00:00Z',
          },
          {
            id: 't7',
            title: 'Add Rate Limiting',
            status: 'in-progress',
            assignee: 'James Wilson',
            dueDate: '2024-05-15T17:00:00Z',
          },
          {
            id: 't8',
            title: 'Security Testing',
            status: 'pending',
            assignee: 'David Park',
            dueDate: '2024-05-18T17:00:00Z',
          },
        ],
        risks: [
          {
            id: 'r4',
            description: 'Breaking existing integrations',
            severity: 'medium',
            status: 'monitored',
          },
          { id: 'r5', description: 'Performance impact', severity: 'low', status: 'monitored' },
        ],
        notes: 'OAuth implementation completed successfully. Rate limiting in final testing phase.',
      },
      m14: {
        id: 'm14',
        name: 'Mobile App Launch',
        description:
          'Launch new mobile application for iOS and Android platforms with core features and marketing campaign',
        status: 'upcoming',
        progress: 45,
        priority: 'high',
        type: 'release',
        created: '2024-05-01T08:00:00Z',
        targetDate: '2024-06-15T18:00:00Z',
        assignees: ['Alex Thompson', 'Maria Garcia', 'Robert Lee', 'Jennifer Kim'],
        dependencies: ['m13'],
        deliverables: [
          {
            id: 'd7',
            name: 'iOS App Build',
            status: 'completed',
            completedDate: '2024-05-10T16:00:00Z',
          },
          { id: 'd8', name: 'Android App Build', status: 'in-progress', completedDate: null },
          { id: 'd9', name: 'App Store Submissions', status: 'pending', completedDate: null },
        ],
        tasks: [
          {
            id: 't9',
            title: 'Finalize iOS Features',
            status: 'completed',
            assignee: 'Alex Thompson',
            dueDate: '2024-05-10T17:00:00Z',
          },
          {
            id: 't10',
            title: 'Complete Android Development',
            status: 'in-progress',
            assignee: 'Maria Garcia',
            dueDate: '2024-05-25T17:00:00Z',
          },
          {
            id: 't11',
            title: 'Submit to App Stores',
            status: 'pending',
            assignee: 'Robert Lee',
            dueDate: '2024-06-01T17:00:00Z',
          },
          {
            id: 't12',
            title: 'Launch Marketing Campaign',
            status: 'pending',
            assignee: 'Jennifer Kim',
            dueDate: '2024-06-10T17:00:00Z',
          },
        ],
        risks: [
          { id: 'r6', description: 'App Store Rejection', severity: 'high', status: 'identified' },
          { id: 'r7', description: 'Launch Delays', severity: 'medium', status: 'monitored' },
          { id: 'r8', description: 'Budget Overrun', severity: 'medium', status: 'controlled' },
        ],
        notes:
          'iOS version ready for beta testing. Android development on track. Marketing materials prepared.',
      },
    };

    const milestone = milestoneData[milestoneId];
    if (!milestone) {
      showNotification(`Milestone ${milestoneId} not found`, 'error');
      return;
    }

    // Create milestone details modal
    const detailsModal = document.createElement('div');
    detailsModal.id = `milestone-details-${milestoneId}`;
    detailsModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const statusColor =
      milestone.status === 'completed'
        ? 'var(--success-color)'
        : milestone.status === 'in-progress'
          ? 'var(--warning-color)'
          : 'var(--primary-color)';

    const priorityColor =
      milestone.priority === 'high'
        ? '#ef4444'
        : milestone.priority === 'medium'
          ? '#f59e0b'
          : '#10b981';

    detailsModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="color: var(--text-primary); margin: 0 0 0.5rem 0;">🎯 ${milestone.name}</h2>
                    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                        <span style="padding: 0.25rem 0.75rem; background: ${statusColor}; color: white; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">
                            ${milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                        </span>
                        <span style="padding: 0.25rem 0.75rem; background: ${priorityColor}; color: white; border-radius: 20px; font-size: 0.8rem; font-weight: 500;">
                            ${milestone.priority.charAt(0).toUpperCase() + milestone.priority.slice(1)} Priority
                        </span>
                        <span style="padding: 0.25rem 0.75rem; background: var(--bg-secondary); color: var(--text-secondary); border-radius: 20px; font-size: 0.8rem; font-weight: 500;">
                            ${milestone.type.charAt(0).toUpperCase() + milestone.type.slice(1)}
                        </span>
                    </div>
                </div>
                <button onclick="closeMilestoneDetails('${milestoneId}')" style="padding: 0.5rem; border: none; border-radius: 6px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; font-size: 1.2rem;">
                    ✕
                </button>
            </div>
            
            <div style="color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.6;">
                ${milestone.description}
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Progress</div>
                    <div style="color: var(--text-primary); font-size: 1.5rem; font-weight: 600;">${milestone.progress}%</div>
                    <div style="width: 100%; height: 6px; background: var(--bg-secondary); border-radius: 3px; margin-top: 0.5rem; overflow: hidden;">
                        <div style="height: 100%; background: ${statusColor}; width: ${milestone.progress}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Target Date</div>
                    <div style="color: var(--text-primary); font-size: 1.1rem; font-weight: 500;">${new Date(milestone.targetDate).toLocaleDateString()}</div>
                </div>
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Team Members</div>
                    <div style="color: var(--text-primary); font-size: 1.1rem; font-weight: 500;">${milestone.assignees.length}</div>
                </div>
                ${
                  milestone.actualCompletion
                    ? `
                <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem;">
                    <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem;">Completed</div>
                    <div style="color: var(--text-primary); font-size: 1.1rem; font-weight: 500;">${new Date(milestone.actualCompletion).toLocaleDateString()}</div>
                </div>
                `
                    : ''
                }
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">👥 Team</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${milestone.assignees
                      .map(
                        (assignee) => `
                        <span style="padding: 0.5rem 1rem; background: var(--bg-secondary); color: var(--text-primary); border-radius: 20px; font-size: 0.9rem;">
                            ${assignee}
                        </span>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📋 Tasks (${milestone.tasks.length})</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${milestone.tasks
                      .map((task) => {
                        const taskStatusColor =
                          task.status === 'completed'
                            ? 'var(--success-color)'
                            : task.status === 'in-progress'
                              ? 'var(--warning-color)'
                              : 'var(--primary-color)';
                        return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">${task.title}</div>
                                <div style="color: var(--text-secondary); font-size: 0.85rem;">Assigned to: ${task.assignee} • Due: ${new Date(task.dueDate).toLocaleDateString()}</div>
                            </div>
                            <span style="padding: 0.25rem 0.75rem; background: ${taskStatusColor}; color: white; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">
                                ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                            </span>
                        </div>
                    `;
                      })
                      .join('')}
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📦 Deliverables (${milestone.deliverables.length})</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${milestone.deliverables
                      .map((deliverable) => {
                        const deliverableStatusColor =
                          deliverable.status === 'completed'
                            ? 'var(--success-color)'
                            : deliverable.status === 'in-progress'
                              ? 'var(--warning-color)'
                              : 'var(--primary-color)';
                        return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                            <div>
                                <div style="color: var(--text-primary); font-weight: 500;">${deliverable.name}</div>
                                ${deliverable.completedDate ? `<div style="color: var(--text-secondary); font-size: 0.85rem;">Completed: ${new Date(deliverable.completedDate).toLocaleDateString()}</div>` : ''}
                            </div>
                            <span style="padding: 0.25rem 0.75rem; background: ${deliverableStatusColor}; color: white; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">
                                ${deliverable.status.charAt(0).toUpperCase() + deliverable.status.slice(1)}
                            </span>
                        </div>
                    `;
                      })
                      .join('')}
                </div>
            </div>
            
            ${
              milestone.risks.length > 0
                ? `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">⚠️ Risks (${milestone.risks.length})</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${milestone.risks
                      .map((risk) => {
                        const riskSeverityColor =
                          risk.severity === 'high'
                            ? '#ef4444'
                            : risk.severity === 'medium'
                              ? '#f59e0b'
                              : '#10b981';
                        return `
                        <div style="padding: 0.75rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                <div style="color: var(--text-primary); font-weight: 500;">${risk.description}</div>
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <span style="padding: 0.25rem 0.5rem; background: ${riskSeverityColor}; color: white; border-radius: 12px; font-size: 0.7rem; font-weight: 500;">
                                        ${risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)}
                                    </span>
                                    <span style="padding: 0.25rem 0.5rem; background: var(--bg-secondary); color: var(--text-secondary); border-radius: 12px; font-size: 0.7rem; font-weight: 500;">
                                        ${risk.status.charAt(0).toUpperCase() + risk.status.slice(1)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                      })
                      .join('')}
                </div>
            </div>
            `
                : ''
            }
            
            ${
              milestone.notes
                ? `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem;">📝 Notes</h4>
                <div style="padding: 1rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-secondary); line-height: 1.6;">
                    ${milestone.notes}
                </div>
            </div>
            `
                : ''
            }
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeMilestoneDetails('${milestoneId}')" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Close
                </button>
                <button onclick="exportMilestoneDetails('${milestoneId}')" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    <i class="fas fa-download"></i> Export Details
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(detailsModal);

    // Add click outside to close
    detailsModal.addEventListener('click', (e) => {
      if (e.target === detailsModal) {
        closeMilestoneDetails(milestoneId);
      }
    });

    // Show modal
    setTimeout(() => {
      detailsModal.style.display = 'flex';
    }, 100);
  }

  function closeMilestoneDetails(milestoneId) {
    const modal = document.getElementById(`milestone-details-${milestoneId}`);
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function exportMilestoneDetails(milestoneId) {
    // This would export the milestone details - for now, just show a notification
    showNotification(`Exporting milestone ${milestoneId} details...`, 'info');
    // In a real implementation, this would call the export system with milestone data
  }

  // Export Team Report function
  function exportTeamReport() {
    console.log('Exporting team report...');

    // Create team export modal
    const exportModal = document.createElement('div');
    exportModal.id = 'team-report-export-modal';
    exportModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    exportModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 600px; width: 90%;">
            <h3 style="color: var(--text-primary); margin-bottom: 1.5rem;">👥 Export Team Report</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Export Format</label>
                    <select id="team-report-format" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="pdf">PDF Report</option>
                        <option value="xlsx">Excel</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Report Type</label>
                    <select id="team-report-type" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary);">
                        <option value="comprehensive">Comprehensive Analysis</option>
                        <option value="performance">Performance Only</option>
                        <option value="departments">Department Breakdown</option>
                        <option value="summary">Executive Summary</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; color: var(--text-primary); margin-bottom: 0.5rem; font-weight: 500;">Include Sections</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Team Overview
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Performance Metrics
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Department Analysis
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Individual Profiles
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Project Contributions
                    </label>
                    <label style="display: flex; align-items: center; color: var(--text-secondary);">
                        <input type="checkbox" checked style="margin-right: 0.5rem;">
                        Skills & Training
                    </label>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="closeTeamReportExportModal()" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
                    Cancel
                </button>
                <button onclick="processTeamReportExport()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; background: var(--primary-color); color: white; cursor: pointer;">
                    Export Report
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(exportModal);

    // Add click outside to close
    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) {
        closeTeamReportExportModal();
      }
    });

    // Show modal
    setTimeout(() => {
      exportModal.style.display = 'flex';
    }, 100);
  }

  function closeTeamReportExportModal() {
    const modal = document.getElementById('team-report-export-modal');
    if (modal) {
      modal.style.display = 'none';
      setTimeout(() => {
        document.body.removeChild(modal);
      }, 300);
    }
  }

  function processTeamReportExport() {
    const format = document.getElementById('team-report-format').value;
    const reportType = document.getElementById('team-report-type').value;

    // Show progress
    const progressModal = document.createElement('div');
    progressModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    progressModal.textContent = `
        <div style="background: var(--card-bg) /* Replaced innerHTML with textContent for safety */ border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; max-width: 400px; width: 90%; text-align: center;">
            <div style="width: 100%; height: 8px; background: var(--bg-primary); border-radius: 4px; margin-bottom: 1rem; overflow: hidden;">
                <div id="team-report-bar" style="height: 100%; background: var(--primary-color); width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="team-report-progress" style="color: var(--text-primary); font-weight: 500;">0%</div>
            <div id="team-report-status" style="color: var(--text-secondary); margin-top: 0.5rem;">Collecting team data...</div>
        </div>
    `;

    document.body.appendChild(progressModal);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);

        setTimeout(() => {
          document.body.removeChild(progressModal);
          closeTeamReportExportModal();

          // Generate content based on format
          const content = generateTeamReportContent(format, reportType);
          let filename, mimeType;

          if (format === 'json') {
            filename = `team-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            mimeType = 'application/json';
          } else if (format === 'csv') {
            filename = `team-report-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
            mimeType = 'text/csv';
          } else if (format === 'xlsx') {
            filename = `team-report-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (format === 'pdf') {
            filename = `team-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
            mimeType = 'application/pdf';
          } else {
            filename = `team-report-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            mimeType = 'text/plain';
          }

          // Download the file
          downloadExportContent(content, filename, mimeType);
          showNotification('Team report exported successfully!', 'success');
        }, 500);
      }

      document.getElementById('team-report-bar').style.width = progress + '%';
      document.getElementById('team-report-progress').textContent = Math.round(progress) + '%';

      const statusElement = document.getElementById('team-report-status');
      if (progress < 20) {
        statusElement.textContent = 'Collecting team information...';
      } else if (progress < 40) {
        statusElement.textContent = 'Analyzing performance data...';
      } else if (progress < 60) {
        statusElement.textContent = 'Processing department metrics...';
      } else if (progress < 80) {
        statusElement.textContent = 'Generating individual profiles...';
      } else {
        statusElement.textContent = 'Finalizing team report...';
      }
    }, 350);
  }

  function generateTeamReportContent(format, reportType) {
    const timestamp = new Date().toLocaleString();

    const teamData = {
      reportInfo: {
        title: 'Team Performance Report',
        generated: timestamp,
        reportType: reportType,
        format: format.toUpperCase(),
      },
      summary: {
        totalMembers: 42,
        totalDepartments: 6,
        avgPerformance: 4.2,
        totalProjects: 18,
        avgSatisfaction: 87,
        totalBudget: 2000000,
        activeSprints: 8,
        completedSprints: 24,
      },
      departments: [
        {
          name: 'Engineering',
          members: 15,
          avgPerformance: 4.5,
          budget: 850000,
          projects: 8,
          satisfaction: 92,
        },
        {
          name: 'Design',
          members: 8,
          avgPerformance: 4.3,
          budget: 320000,
          projects: 4,
          satisfaction: 88,
        },
        {
          name: 'Marketing',
          members: 7,
          avgPerformance: 4.1,
          budget: 280000,
          projects: 3,
          satisfaction: 85,
        },
        {
          name: 'Sales',
          members: 6,
          avgPerformance: 4.0,
          budget: 250000,
          projects: 2,
          satisfaction: 82,
        },
        {
          name: 'HR',
          members: 4,
          avgPerformance: 4.2,
          budget: 180000,
          projects: 1,
          satisfaction: 90,
        },
        {
          name: 'Operations',
          members: 2,
          avgPerformance: 4.4,
          budget: 120000,
          projects: 0,
          satisfaction: 87,
        },
      ],
      teamMembers: [
        {
          name: 'John Smith',
          department: 'Engineering',
          role: 'Senior Developer',
          performance: 4.8,
          projects: 8,
          skills: ['JavaScript', 'Python', 'React'],
          satisfaction: 95,
        },
        {
          name: 'Emily Davis',
          department: 'Design',
          role: 'UI/UX Designer',
          performance: 4.7,
          projects: 6,
          skills: ['Figma', 'Sketch', 'CSS'],
          satisfaction: 92,
        },
        {
          name: 'Michael Brown',
          department: 'Engineering',
          role: 'Backend Developer',
          performance: 4.6,
          projects: 7,
          skills: ['Java', 'Spring', 'SQL'],
          satisfaction: 90,
        },
        {
          name: 'Sarah Wilson',
          department: 'Marketing',
          role: 'Marketing Manager',
          performance: 4.5,
          projects: 4,
          skills: ['SEO', 'Analytics', 'Content'],
          satisfaction: 88,
        },
        {
          name: 'David Lee',
          department: 'Sales',
          role: 'Sales Lead',
          performance: 4.4,
          projects: 3,
          skills: ['Negotiation', 'CRM', 'Presentation'],
          satisfaction: 86,
        },
