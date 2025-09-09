import React, { useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [players, setPlayers] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [refundData, setRefundData] = useState({ type: 'money', amount: '', item_name: '', vehicle_model: '', vehicle_plate: '', reason: '' });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get('/api/players').then(() => {
            setIsLoggedIn(true);
            loadPlayers();
            loadLogs();
        }).catch(() => setIsLoggedIn(false));
    }, []);

    const loadPlayers = async () => {
        const res = await axios.get('/api/players');
        setPlayers(res.data);
    };

    const handleSearch = async () => {
        setLoading(true);
        const res = await axios.post('/api/search-player', { search });
        setPlayers(res.data);
        setLoading(false);
    };

    const handleCreateRefund = async () => {
        if (!selectedPlayer) return alert('Selecteer een speler');
        setLoading(true);
        try {
            await axios.post('/api/create-refund', {
                player_identifier: selectedPlayer.identifier,
                player_name: selectedPlayer.name,
                player_discord: selectedPlayer.discord_id,
                ...refundData
            });
            alert('Refund klaargezet!');
            setRefundData({ type: 'money', amount: '', item_name: '', vehicle_model: '', vehicle_plate: '', reason: '' });
            loadLogs();
        } catch (err) {
            alert('Fout: ' + (err.response?.data?.error || err.message));
        }
        setLoading(false);
    };

    const loadLogs = async () => {
        const res = await axios.get('/api/logs');
        setLogs(res.data);
    };

    if (!isLoggedIn) {
        return (
            <div style={{textAlign: 'center', padding: '50px'}}>
                <h1>Refund Panel</h1>
                <button onClick={() => window.location.href = '/auth/discord'} style={{padding: '15px 30px', fontSize: '18px', background: '#7289da', color: 'white', border: 'none', borderRadius: '5px'}}>
                    Login met Discord
                </button>
                <p style={{marginTop: '20px'}}>Admin rol vereist.</p>
            </div>
        );
    }

    return (
        <div style={{padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial'}}>
            <h1>Refund Panel</h1>

            <div style={{marginBottom: '20px'}}>
                <input 
                    type="text" 
                    placeholder="Zoek speler (naam, ID, license, discord)" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    style={{padding: '10px', width: '300px', marginRight: '10px'}} 
                />
                <button onClick={handleSearch} disabled={loading} style={{padding: '10px 15px', marginRight: '10px'}}>
                    Zoeken
                </button>
                <button onClick={loadPlayers} style={{padding: '10px 15px'}}>Alle spelers</button>
            </div>

            <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '20px'}}>
                <thead>
                    <tr style={{backgroundColor: '#f0f0f0'}}>
                        <th style={{border: '1px solid #ddd', padding: '10px'}}>Naam</th>
                        <th style={{border: '1px solid #ddd', padding: '10px'}}>Identifier</th>
                        <th style={{border: '1px solid #ddd', padding: '10px'}}>Discord ID</th>
                        <th style={{border: '1px solid #ddd', padding: '10px'}}>Actie</th>
                    </tr>
                </thead>
                <tbody>
                    {players.map(p => (
                        <tr key={p.identifier}>
                            <td style={{border: '1px solid #ddd', padding: '10px'}}>{p.name}</td>
                            <td style={{border: '1px solid #ddd', padding: '10px'}}>{p.identifier}</td>
                            <td style={{border: '1px solid #ddd', padding: '10px'}}>{p.discord_id || 'Geen'}</td>
                            <td style={{border: '1px solid #ddd', padding: '10px'}}>
                                <button onClick={() => setSelectedPlayer(p)} style={{padding: '5px 10px', background: '#4CAF50', color: 'white', border: 'none'}}>
                                    Selecteer
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {selectedPlayer && (
                <div style={{border: '1px solid #ccc', padding: '20px', marginBottom: '20px', borderRadius: '5px'}}>
                    <h2>Refund voor {selectedPlayer.name}</h2>
                    <select 
                        value={refundData.type} 
                        onChange={e => {
                            const newData = { ...refundData, type: e.target.value };
                            if (e.target.value !== 'money') newData.amount = '';
                            if (e.target.value !== 'item') newData.item_name = '';
                            if (e.target.value !== 'vehicle') { newData.vehicle_model = ''; newData.vehicle_plate = ''; }
                            setRefundData(newData);
                        }} 
                        style={{padding: '10px', marginRight: '10px'}}
                    >
                        <option value="money">Geld</option>
                        <option value="item">Item</option>
                        <option value="vehicle">Voertuig</option>
                    </select>

                    {refundData.type === 'money' && (
                        <input type="number" placeholder="Bedrag (bijv. 5000)" value={refundData.amount} onChange={e => setRefundData({...refundData, amount: e.target.value})} style={{padding: '10px', marginRight: '10px'}} />
                    )}

                    {refundData.type === 'item' && (
                        <>
                            <input type="text" placeholder="Item naam (bijv. bread)" value={refundData.item_name} onChange={e => setRefundData({...refundData, item_name: e.target.value})} style={{padding: '10px', marginRight: '10px'}} />
                            <input type="number" placeholder="Aantal" value={refundData.amount} onChange={e => setRefundData({...refundData, amount: e.target.value})} style={{padding: '10px', marginRight: '10px'}} />
                        </>
                    )}

                    {refundData.type === 'vehicle' && (
                        <>
                            <input type="text" placeholder="Model (bijv. adder)" value={refundData.vehicle_model} onChange={e => setRefundData({...refundData, vehicle_model: e.target.value})} style={{padding: '10px', marginRight: '10px'}} />
                            <input type="text" placeholder="Kenteken (optioneel)" value={refundData.vehicle_plate} onChange={e => setRefundData({...refundData, vehicle_plate: e.target.value})} style={{padding: '10px', marginRight: '10px'}} />
                        </>
                    )}

                    <br />
                    <textarea placeholder="Reden (optioneel)" value={refundData.reason} onChange={e => setRefundData({...refundData, reason: e.target.value})} style={{width: '400px', height: '80px', marginTop: '10px'}} />
                    <br />
                    <button onClick={handleCreateRefund} disabled={loading} style={{padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', marginTop: '10px'}}>
                        Klaarmaken
                    </button>
                    <button onClick={() => setSelectedPlayer(null)} style={{padding: '10px 20px', background: '#f44336', color: 'white', border: 'none', marginLeft: '10px'}}>
                        Annuleer
                    </button>
                </div>
            )}

            <h2>Logs</h2>
            <button onClick={loadLogs} style={{padding: '5px 10px'}}>Vernieuwen</button>
            <ul style={{listStyle: 'none', padding: 0}}>
                {logs.map((log, index) => (
                    <li key={index} style={{borderBottom: '1px solid #eee', padding: '10px'}}>
                        <strong>{log.action?.toUpperCase()}</strong>: {log.details || `${log.type} voor ${log.player_name}`} - {new Date(log.timestamp).toLocaleString('nl-NL')} - Status: {log.status}
                    </li>
                ))}
            </ul>
            {logs.length === 0 && <p>Geen logs.</p>}
        </div>
    );
}

export default App;
