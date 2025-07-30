
import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


const RefreeEvents = () => {
  const location = useLocation();
  const params = useParams();
  const tournament = location.state;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournamentName, setTournamentName] = useState(tournament?.name || "");

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [fixturesError, setFixturesError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [scoringFixture, setScoringFixture] = useState(null);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [selectedSet, setSelectedSet] = useState(1);
  const [setScores, setSetScores] = useState([]); // [{teamAScore, teamBScore}]

  const backend_URL = import.meta.env.VITE_BACKEND_URL;

  // Open Scoring Modal
  const openScoringModal = (fixture) => {
    setScoringFixture(fixture);
    // Prepare setScores from fixture.sets or default
    let scores = [];
    const maxSets = fixture.maxSets || 3;
    if (fixture.sets && fixture.sets.length > 0) {
      scores = fixture.sets.map(s => ({ teamAScore: s.teamAScore ?? 0, teamBScore: s.teamBScore ?? 0 }));
    } else {
      scores = [];
    }
    // Pad scores to maxSets
    while (scores.length < maxSets) {
      scores.push({ teamAScore: 0, teamBScore: 0 });
    }
    setSetScores(scores);
    setSelectedSet(1);
    setShowScoringModal(true);
  };


  // Close Scoring Modal
  const closeScoringModal = () => {
    setScoringFixture(null);
    setShowScoringModal(false);
    setSetScores([]);
    setSelectedSet(1);
  };


  // Save Score
  const handleSaveScore = async () => {
    // Prepare new sets array for PATCH
    const sets = setScores.map((s, idx) => ({
      setNumber: idx + 1,
      teamAScore: s.teamAScore,
      teamBScore: s.teamBScore,
    }));
    const updatedFixture = {
      ...scoringFixture,
      sets,
      status: 'completed',
    };

    try {
      const response = await fetch(`${backend_URL}/api/player/fixtures/${scoringFixture._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sets,
          status: 'completed',
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update score");
      }

      // Update fixtures locally
      setFixtures(prev =>
        prev.map(f => (f._id === updatedFixture._id ? updatedFixture : f))
      );

      toast.success("Score saved successfully!");
      closeScoringModal();
    } catch (error) {
      console.error("Error saving score:", error);
      toast.error("Failed to save score. Please try again.");
    }
  };

  // Fetch Events
  useEffect(() => {
    const fetchEventsAndTournament = async () => {
      setLoading(true);
      setError(null);
      try {
        let tName = tournament?.name;
        if (!tName) {
          // fetch tournament details for name
          try {
            const details = await import('@/lib/api').then(m => m.fetchTournamentDetails(params.id));
            tName = details?.name || params.id;
            setTournamentName(tName);
          } catch (err) {
            setTournamentName(params.id);
          }
        } else {
          setTournamentName(tName);
        }
        if (tournament?.events?.length && typeof tournament.events[0] === 'object') {
          setEvents(tournament.events);
        } else {
          const url = backend_URL
            ? `${backend_URL.replace(/['\s]/g, '')}/api/player/tournaments/${params.id}/events`
            : `/api/player/tournaments/${params.id}/events`;
          const response = await fetch(url);
          const data = await response.json();
          if (data.success && Array.isArray(data.message)) {
            setEvents(data.message);
          } else {
            setError(data.message || 'Failed to fetch events');
          }
        }
      } catch (err) {
        setError('Error fetching events');
      } finally {
        setLoading(false);
      }
    };
    fetchEventsAndTournament();
  }, [tournament, params.id]);



  // Fetch Fixtures
  const handleEventClick = async (event) => {
    setSelectedEvent(event);
    setFixtures([]);
    setFixturesLoading(true);
    setFixturesError(null);
    try {
      const url = backend_URL
        ? `${backend_URL.replace(/['\s]/g, '')}/api/player/events/${event._id}/fixtures`
        : `/api/player/events/${event._id}/fixtures`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success && Array.isArray(data.fixtures)) {
        setFixtures(data.fixtures);
      } else {
        setFixturesError(data.message || 'Failed to fetch matches');
      }
    } catch (err) {
      setFixturesError('Error fetching matches');
    } finally {
      setFixturesLoading(false);
    }


  };


  return (
    <div className="flex flex-col min-h-screen">
      <Navigation />
      <motion.div className="flex-1 flex flex-col items-center px-4 py-8 pt-30"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h1 className="text-3xl font-bold mb-4">
          Events for Tournament: {tournamentName}
        </h1>

        {loading ? (
          <div>Loading events...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : events.length > 0 ? (""
          // <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          //   {events.map((event) => (
          //     <div
          //       key={event._id}
          //       className="cursor-pointer bg-white shadow-lg rounded-xl p-6 transition-transform hover:scale-105 hover:shadow-2xl border"
          //       onClick={() => handleEventClick(event)}
          //     >
          //       <div className="text-xl font-bold text-blue-700 mb-1">{event.name}</div>
          //       <div className="flex items-center gap-4 text-gray-600 text-sm">

          //         <span className="px-2 py-1 bg-gray-100 rounded-full text-blue-700 font-semibold">
          //           {event.eventType2 || event.eventType}
          //         </span>
          //         <span className="px-2 py-1 bg-gray-100 rounded-full font-medium">
          //           {event.matchType?.replace(/-/g, ' ') || ''}
          //         </span>
          //       </div>
          //     </div>
          //   ))}
          // </div>
        ) : (
          <div>No events found for this tournament.</div>
        )}
        <div className="scores-controls">
          <div className="scores-filters">
            <div className="scores-filter-group">
              <select
                value={selectedEvent?._id || ""}
                onChange={(e) => {
                  const eventId = e.target.value;
                  const selected = events.find(ev => ev._id === eventId);
                  if (selected) {
                    handleEventClick(selected);  // fetch fixtures for this event
                  }
                }}
                className="scores-filter-select"
              >
                <option value="" disabled>Select an event</option>
                {events.map(event => (
                  <option key={event._id} value={event._id}>{event.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>


        {/* Fixture Cards */}
        {selectedEvent && (
          <div className="mt-10 w-full max-w-3xl">
            <h2 className="text-2xl font-bold mb-4 text-center text-indigo-700">
              Matches for: <span className="underline">{selectedEvent.name}</span>
            </h2>

            {/* Search Box */}
    <div className="mb-6 text-center">
      <input
        type="text"
        placeholder="Search by team name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full md:w-1/2 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>



            {fixturesLoading ? (
              <div className="text-center">Loading matches...</div>
            ) : fixturesError ? (
              <div className="text-red-600 text-center">{fixturesError}</div>
            ) : fixtures.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {fixtures
  .filter(fixture => {
    const teamA = fixture.teamA?.name || fixture.teamA?.teamName || '';
    const teamB = fixture.teamB?.name || fixture.teamB?.teamName || '';
    return (
      teamA.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teamB.toLowerCase().includes(searchTerm.toLowerCase())
    );
  })
  .map((fixture, idx) => {
                  const teamA = fixture.teamA?.name || fixture.teamA?.teamName || 'Team A';
                  const teamB = fixture.teamB?.name || fixture.teamB?.teamName || 'Team B';
                  const status = fixture.status;
                  const statusLabel = status === 'live' ? 'LIVE' : status === 'completed' ? 'COMPLETED' : 'UPCOMING';
                  const statusColor = status === 'live'
                    ? 'bg-yellow-100 text-yellow-800'
                    : status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800';
                  const time = fixture.scheduledAt
                    ? new Date(fixture.scheduledAt).toLocaleString()
                    : 'Time TBD';

                 

                  return (
                    <div key={idx} className="bg-[#f5f9fc] rounded-xl shadow-md p-6 border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase">
                          {fixture.roundName || "Unknown"}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="text-center mb-2">
                        <div className="text-lg font-semibold text-gray-800">
                          {teamA} <span className="text-gray-500">vs</span> {teamB}
                        </div>
                        <div className="text-green-700 font-mono text-md mt-1">
                          {fixture.sets && fixture.sets.length > 0 ? (
                            <div>
                              {fixture.sets.map((set, i) => (
                                <div key={i} className="inline-block mr-2">
                                  <span className="font-semibold">Set {set.setNumber}:</span> {set.teamAScore} - {set.teamBScore}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>No set scores</span>
                          )}
                        </div>
                      </div>
                      <div className="text-center mt-3">
                        <button
                          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-md transition"
                          onClick={() => openScoringModal(fixture)}
                        >
                          Score
                        </button>
                      </div>
                      <div className="text-right text-xs text-gray-500 mt-3">{fixture.scheduledAt ? new Date(fixture.scheduledAt).toLocaleString() : ''}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center">No matches found for this event.</div>
            )}
          </div>
        )}
      </motion.div>

      {/* Scoring Modal */}
      {showScoringModal && scoringFixture && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl relative">
            <button
              className="absolute top-3 right-4 text-gray-600 hover:text-black text-xl font-bold"
              onClick={closeScoringModal}
            >
              ×
            </button>

            <h2 className="text-2xl font-bold text-center mb-2">Live Scoring</h2>
            <p className="text-center text-sm text-gray-500 mb-6">
              Event: {selectedEvent?.name || scoringFixture.eventName || scoringFixture.category || 'N/A'}
            </p>

            <div className="text-center font-semibold text-xl mb-6">
              {scoringFixture.teamA?.name || scoringFixture.teamA?.teamName || 'Team A'} vs{' '}
              {scoringFixture.teamB?.name || scoringFixture.teamB?.teamName || 'Team B'}
            </div>

            <div className="mb-4">
              <label className="block text-center font-semibold mb-2">Select Set</label>
              <select
                className="block mx-auto mb-4 px-3 py-2 border rounded-lg"
                value={selectedSet}
                onChange={e => setSelectedSet(Number(e.target.value))}
              >
                {Array.from({ length: scoringFixture.maxSets || 3 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Set {i + 1}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-6 bg-blue-50 rounded-xl py-6">
                {/* Team A */}
                <div className="flex flex-col items-center justify-center">
                  <h3 className="font-semibold mb-2">
                    {scoringFixture.teamA?.name || scoringFixture.teamA?.teamName || 'Team A'}
                  </h3>
                  <div className="text-5xl font-bold text-blue-600 mb-4">{setScores[selectedSet - 1]?.teamAScore ?? 0}</div>
                  <div className="flex gap-4">
                    <button
                      className="w-10 h-10 rounded-full bg-gray-100 text-xl text-gray-700"
                      onClick={() => setSetScores(scores => scores.map((s, idx) => idx === selectedSet - 1 ? { ...s, teamAScore: Math.max(0, s.teamAScore - 1) } : s))}
                    >
                      -
                    </button>
                    <button
                      className="w-10 h-10 rounded-full bg-blue-500 text-white text-xl"
                      onClick={() => setSetScores(scores => scores.map((s, idx) => idx === selectedSet - 1 ? { ...s, teamAScore: s.teamAScore + 1 } : s))}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Team B */}
                <div className="flex flex-col items-center justify-center">
                  <h3 className="font-semibold mb-2">
                    {scoringFixture.teamB?.name || scoringFixture.teamB?.teamName || 'Team B'}
                  </h3>
                  <div className="text-5xl font-bold text-red-500 mb-4">{setScores[selectedSet - 1]?.teamBScore ?? 0}</div>
                  <div className="flex gap-4">
                    <button
                      className="w-10 h-10 rounded-full bg-gray-100 text-xl text-gray-700"
                      onClick={() => setSetScores(scores => scores.map((s, idx) => idx === selectedSet - 1 ? { ...s, teamBScore: Math.max(0, s.teamBScore - 1) } : s))}
                    >
                      -
                    </button>
                    <button
                      className="w-10 h-10 rounded-full bg-red-500 text-white text-xl"
                      onClick={() => setSetScores(scores => scores.map((s, idx) => idx === selectedSet - 1 ? { ...s, teamBScore: s.teamBScore + 1 } : s))}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Score */}
            <div className="mt-6 text-center">
              <button
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg transition"
                onClick={handleSaveScore}
              >
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default RefreeEvents;
