using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// GameManager - Orchestrates the full hybrid loop:
/// Safari Deploy (ARU placement + schedule) → feeds clips → Kaleidoscope Quest puzzle → Echoes habitat impact + Guild share.
/// Personas adapt difficulty/hints/rewards (per panel + all 4 user types).
/// </summary>
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("Cross-Module References")]
    public SpectrogramPuzzle questPuzzle;
    public AudioManager audioManager;

    [Header("Progress")]
    public string currentPersona = "Liam"; // Elena | Marty | Aisha | Liam
    public int streak = 0;
    public int totalSpeciesLogged = 0;
    public float acousticHealth = 72f; // Echoes sim metric

    private List<SpeciesClipData> currentDeploymentClips = new List<SpeciesClipData>();

    void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    // Called from Safari deploy flow
    public void OnSongMeterDeployed(string location, string[] scheduleTimes, List<SpeciesClipData> generatedClips)
    {
        currentDeploymentClips = generatedClips;

        // Simulate WA real recording session complete
        Debug.Log($"[WA] Song Meter deployed at {location}. Schedule: {string.Join(", ", scheduleTimes)}. Clips ready for Kaleidoscope analysis.");

        // Auto or player-triggered: load the clips into the Quest puzzle
        if (questPuzzle != null)
        {
            questPuzzle.StartNewPuzzle(currentDeploymentClips, OnQuestComplete);
        }
    }

    public void ReportQuestResult(string recordingId, float accuracy, bool passed)
    {
        // Update global + persona-specific progress
        if (passed)
        {
            totalSpeciesLogged += Mathf.RoundToInt(accuracy * 3);
            acousticHealth = Mathf.Clamp(acousticHealth + accuracy * 8f, 0, 100);
        }

        // Guild / social hook (shareable "report")
        string report = $"BioAcoustics Explorer Report\nRecording {recordingId}\nAccuracy: {accuracy*100:0}%\nSpecies logged: {totalSpeciesLogged}\nAcoustic Health: {acousticHealth:0}%\nAnalyzed with Kaleidoscope-style clustering\n#WildlifeAcoustics";
        Debug.Log("[Guild] " + report); // In real: push to Firebase guild feed or copy-to-clipboard

        // Story / Echoes advancement
        if (acousticHealth > 85) Debug.Log("[Story] Habitat showing strong recovery. New narrative beat unlocked.");
    }

    private void OnQuestComplete()
    {
        // Trigger Echoes of the Wild restoration moment or daily reward
        Debug.Log($"[Echoes] Soundscape updated. Current acoustic health: {acousticHealth}");
        // Here you would load the Echoes sim scene or update the habitat visual
    }

    public void SetPersona(string persona)
    {
        currentPersona = persona;
        // Adapt difficulty: Elena gets stricter scoring + export button; Liam gets more generous rewards + hints
        Debug.Log($"[Persona] Switched to {persona}. UI and scoring adapted.");
    }

    // Daily challenge stub (Duolingo-style)
    public void ClaimDailyChallenge()
    {
        streak++;
        Debug.Log($"Streak: {streak} days. Reward: +10 acoustic insight points + new badge hint for WA Academy.");
    }
}
