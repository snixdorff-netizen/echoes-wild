using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using TMPro;

/// <summary>
/// SpectrogramPuzzle - The heart of Kaleidoscope Quest.
/// Full drag-and-drop clustering inspired directly by Wildlife Acoustics Kaleidoscope Pro.
/// Players sort audio feature segments into biologically meaningful clusters.
/// Scoring, feedback, and cross-progression to Guild + Story (as per v0.4 prototype + panel).
/// </summary>
public class SpectrogramPuzzle : MonoBehaviour
{
    [Header("WA Kaleidoscope UI")]
    public Transform segmentContainer;      // Parent for draggable segments
    public Transform[] clusterZones;        // Drop targets: 0=BatFM, 1=BirdTrill, 2=FrogPeep, 3=Mammal, 4=Noise
    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI feedbackText;
    public Button submitButton;
    public Button replayAllButton;

    [Header("Data")]
    public List<DraggableSegment> currentSegments = new List<DraggableSegment>();
    public int correctPlacements = 0;

    private string currentRecordingId;
    private System.Action onComplete;

    public void StartNewPuzzle(List<SpeciesClipData> clipsForThisRecording, System.Action completeCallback)
    {
        Clear();
        onComplete = completeCallback;
        currentRecordingId = System.Guid.NewGuid().ToString();

        // Spawn draggable segments from the Safari-deployed clips (cross-progression)
        foreach (var clipData in clipsForThisRecording)
        {
            // In real build: Instantiate from prefab that has DraggableSegment + Image + optional mini waveform
            GameObject segGO = new GameObject("Segment_" + clipData.speciesId, typeof(RectTransform), typeof(DraggableSegment), typeof(Image));
            segGO.transform.SetParent(segmentContainer, false);

            DraggableSegment seg = segGO.GetComponent<DraggableSegment>();
            seg.clusterType = clipData.expectedCluster;
            seg.displayLabel = clipData.featureLabel;
            seg.associatedClip = clipData.clip;
            seg.puzzle = this;

            // Style it (WA spectrogram segment look)
            Image img = segGO.GetComponent<Image>();
            img.color = clipData.uiColor;

            // Add simple label
            var label = new GameObject("Label", typeof(TextMeshProUGUI));
            label.transform.SetParent(segGO.transform, false);
            var tmp = label.GetComponent<TextMeshProUGUI>();
            tmp.text = clipData.featureLabel;
            tmp.fontSize = 10;
            tmp.alignment = TextAlignmentOptions.Center;

            currentSegments.Add(seg);
        }

        correctPlacements = 0;
        UpdateScoreUI();
        feedbackText.text = "Drag segments into the correct Kaleidoscope clusters (based on call structure).";
        submitButton.onClick.RemoveAllListeners();
        submitButton.onClick.AddListener(SubmitClustering);
    }

    public void OnSegmentDroppedCorrectly(DraggableSegment seg, string zoneType)
    {
        if (seg.clusterType == zoneType)
        {
            correctPlacements++;
            // Play confirmation sound via AudioManager
            UpdateScoreUI();
            feedbackText.text = $"Good cluster! {correctPlacements}/{currentSegments.Count}";
        }
        else
        {
            feedbackText.text = "That feature doesn't match the cluster. Try again or use replay.";
            // Optional: gentle penalty or hint
        }
    }

    private void UpdateScoreUI()
    {
        scoreText.text = $"{correctPlacements} / {currentSegments.Count}  |  Confidence: {(int)((float)correctPlacements / currentSegments.Count * 100)}%";
    }

    private void SubmitClustering()
    {
        float accuracy = (float)correctPlacements / currentSegments.Count;
        bool passed = accuracy >= 0.7f;

        feedbackText.text = passed 
            ? $"Excellent work! Kaleidoscope confidence {accuracy*100:0}% — habitat data contributed." 
            : $"Clustering complete. Accuracy {accuracy*100:0}%. Review and try for higher mastery.";

        // Cross-progression hooks (exactly as required)
        if (GameManager.Instance != null)
        {
            GameManager.Instance.ReportQuestResult(currentRecordingId, accuracy, passed);
        }

        submitButton.interactable = false;

        // Auto-advance after short delay (or let player continue)
        Invoke(nameof(CompletePuzzle), 1.8f);
    }

    private void CompletePuzzle()
    {
        onComplete?.Invoke();
        // Optionally clear or leave state for review
    }

    public void Clear()
    {
        foreach (var seg in currentSegments) if (seg != null) Destroy(seg.gameObject);
        currentSegments.Clear();
        submitButton.interactable = true;
    }

    // Helper for replaying the "recording" mix (WA realism)
    public void ReplayRecordingMix()
    {
        // Trigger AudioManager to play the original clips in sequence or overlapped
        feedbackText.text = "Replaying original recording mix... listen for the distinct structures.";
    }
}

[System.Serializable]
public class SpeciesClipData
{
    public string speciesId;
    public string expectedCluster; // Must match DraggableSegment.clusterType
    public string featureLabel;
    public AudioClip clip;
    public Color uiColor;
}
