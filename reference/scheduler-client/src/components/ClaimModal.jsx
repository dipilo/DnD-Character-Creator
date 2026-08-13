import React, { useState, useEffect, useRef } from 'react';
import { claimPlayer } from '../api';

export default function ClaimModal({ campaignId, unclaimedPlayers = [], open, onClose, onClaimed, userId }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing claim...');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const lastRequestRef = useRef(null);
  
  // Auto-select first unclaimed player if available
  useEffect(() => {
    if (open && unclaimedPlayers.length > 0 && !selectedPlayerId && !creatingNew) {
      setSelectedPlayerId(unclaimedPlayers[0].id);
    }
  }, [open, unclaimedPlayers, selectedPlayerId, creatingNew]);
  
  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setError('');
      setValidationErrors({});
      setLoadingMessage('Processing claim...');
    }
  }, [open]);

  if (!open) return null;

  // Client-side validation
  function validateForm() {
    const errors = {};
    
    if (!userId && !name.trim()) {
      errors.name = 'Username is required for anonymous claiming';
    }
    
    if (!creatingNew && !selectedPlayerId) {
      errors.selection = 'Please select a player or choose "Create new"';
    }
    
    if (creatingNew && !name.trim()) {
      errors.name = 'Player name is required when creating new player';
    }
    
    if (name.trim().length > 50) {
      errors.name = 'Name must be 50 characters or less';
    }
    
    if (password && password.length < 3) {
      errors.password = 'Password must be at least 3 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleClaim() {
    // Prevent duplicate submissions
    if (loading) return;
    
    setError('');
    setValidationErrors({});
    
    if (!validateForm()) return;
    
    // Cancel any previous request
    if (lastRequestRef.current) {
      lastRequestRef.current = null;
    }
    
    const payload = {};
    if (!creatingNew) {
      payload.player_id = selectedPlayerId;
    } else {
      payload.name = name.trim();
    }
    
    if (!userId) {
      payload.name = name.trim();
      if (password) payload.password = password;
    }
    
    setLoading(true);
    setLoadingMessage('Processing claim...');
    
    // Progressive loading messages
    const timer1 = setTimeout(() => {
      if (loading) setLoadingMessage('Still processing... (slow connection detected)');
    }, 3000);
    
    const timer2 = setTimeout(() => {
      if (loading) setLoadingMessage('Almost done... (retrying connection)');
    }, 8000);
    
    const currentRequest = { cancelled: false };
    lastRequestRef.current = currentRequest;
    
    try {
      const res = await claimPlayer(campaignId, payload, userId);
      
      // Check if request was cancelled
      if (currentRequest.cancelled) return;
      
      if (res && res.ok) {
        if (res.user_id) onClaimed && onClaimed(String(res.user_id));
        else onClaimed && onClaimed(null);
        onClose && onClose();
      } else {
        setError('Claim failed - please try again');
      }
    } catch (e) {
      // Check if request was cancelled
      if (currentRequest.cancelled) return;
      
      let msg = e && e.message ? e.message : String(e);
      try { 
        const parsed = JSON.parse(msg); 
        if (parsed && parsed.error) msg = parsed.error; 
      } catch(_) {}
      
      // User-friendly error messages
      if (msg.includes('already_claimed')) {
        setError('This player has already been claimed by someone else.');
      } else if (msg.includes('player_not_found')) {
        setError('Player not found - it may have been removed.');
      } else if (msg.includes('timeout') || msg.includes('Network error')) {
        setError('Connection timeout - please check your internet and try again.');
      } else {
        setError(msg);
      }
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (!currentRequest.cancelled) {
        setLoading(false);
        setLoadingMessage('Processing claim...');
      }
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 520 }}>
        <h3>Claim a player</h3>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Choose an existing unclaimed player or create a new one</label>
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            {unclaimedPlayers.map(p => (
              <label key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, border: '1px solid var(--border)', background: 'var(--panel)' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.discord || ''}</div>
                </div>
                <input type="radio" name="claim_player" checked={selectedPlayerId === p.id && !creatingNew} onChange={() => { setCreatingNew(false); setSelectedPlayerId(p.id); }} />
              </label>
            ))}
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, border: '1px solid var(--border)', background: 'var(--panel)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Create new player</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Make a new player record and claim it</div>
              </div>
              <input type="radio" name="claim_player" checked={creatingNew} onChange={() => { setCreatingNew(true); setSelectedPlayerId(null); }} />
            </label>
          </div>
        </div>

        {(creatingNew || !userId) && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', marginBottom: 6 }}>
              {creatingNew ? 'Player name (required)' : 'Account username (required)'}
            </label>
            <input 
              value={name} 
              onChange={e => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors(prev => ({ ...prev, name: undefined }));
                }
              }}
              style={{ 
                width: '100%', 
                padding: 8,
                border: validationErrors.name ? '2px solid var(--danger)' : '1px solid var(--border)'
              }}
              placeholder={creatingNew ? 'Enter player name' : 'Enter username'}
              maxLength={50}
            />
            {validationErrors.name && (
              <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                {validationErrors.name}
              </div>
            )}
            
            {!userId && (
              <>
                <label style={{ display: 'block', margin: '8px 0 6px' }}>
                  Optional password (to allow later login)
                </label>
                <input 
                  value={password} 
                  onChange={e => {
                    setPassword(e.target.value);
                    if (validationErrors.password) {
                      setValidationErrors(prev => ({ ...prev, password: undefined }));
                    }
                  }}
                  type="password" 
                  style={{ 
                    width: '100%', 
                    padding: 8,
                    border: validationErrors.password ? '2px solid var(--danger)' : '1px solid var(--border)'
                  }}
                  placeholder="Optional password"
                />
                {validationErrors.password && (
                  <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                    {validationErrors.password}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {validationErrors.selection && (
          <div style={{ color: 'var(--danger)', fontSize: 14, marginTop: 8 }}>
            {validationErrors.selection}
          </div>
        )}

        {error && (
          <div style={{ 
            color: 'var(--danger)', 
            marginTop: 8, 
            padding: 8, 
            background: 'rgba(220, 53, 69, 0.1)', 
            border: '1px solid rgba(220, 53, 69, 0.3)', 
            borderRadius: 4 
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ 
            marginTop: 8, 
            padding: 8, 
            background: 'rgba(0, 123, 255, 0.1)', 
            border: '1px solid rgba(0, 123, 255, 0.3)', 
            borderRadius: 4,
            fontSize: 14
          }}>
            <div>{loadingMessage}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              Please wait, processing your request...
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button 
            onClick={() => { 
              if (lastRequestRef.current) {
                lastRequestRef.current.cancelled = true;
              }
              onClose && onClose(); 
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            onClick={handleClaim} 
            disabled={loading} 
            style={{ 
              background: loading ? 'var(--muted)' : 'var(--accent)', 
              color: 'var(--on-accent)',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? loadingMessage.split(' ')[0] + '...' : 'Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
