using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.UI;

[DefaultExecutionOrder(-150)]
public class SimpleNavMeshSurface : MonoBehaviour
{
    [SerializeField] private Vector3 navMeshBounds = new Vector3(40f, 10f, 40f);
    [SerializeField] private int agentTypeId = 0;

    private NavMeshData navMeshData;
    private NavMeshDataInstance navMeshInstance;

    void OnEnable()
    {
        BuildNavMesh();
    }

    void OnDisable()
    {
        navMeshInstance.Remove();
    }

    public void BuildNavMesh()
    {
        if (navMeshData == null)
        {
            navMeshData = new NavMeshData(agentTypeId);
        }

        var sources = new List<NavMeshBuildSource>();
        var markups = new List<NavMeshBuildMarkup>();
        NavMeshBuilder.CollectSources(new Bounds(Vector3.zero, navMeshBounds), ~0, NavMeshCollectGeometry.RenderMeshes, 0, markups, sources);
        var settings = NavMesh.GetSettingsByID(agentTypeId);
        var bounds = new Bounds(Vector3.zero, navMeshBounds);
        NavMeshBuilder.UpdateNavMeshData(navMeshData, settings, sources, bounds);

        navMeshInstance.Remove();
        navMeshInstance = NavMesh.AddNavMeshData(navMeshData);
    }
}

public class FPS_ALLINONE_FULL : MonoBehaviour
{
    [Header("Character Setup")]
    [SerializeField] private CharacterController controller;
    [SerializeField] private Camera playerCamera;
    [SerializeField] private Transform muzzleTransform;

    [Header("Gameplay Settings")]
    [SerializeField] private float moveSpeed = 6f;
    [SerializeField] private float sprintMultiplier = 1.5f;
    [SerializeField] private float lookSpeed = 2f;
    [SerializeField] private float gravity = -9.81f;
    [SerializeField] private float jumpHeight = 1.2f;

    [Header("Combat Settings")]
    [SerializeField] private float fireRate = 0.3f;
    [SerializeField] private float shootRange = 60f;
    [SerializeField] private int damagePerShot = 34;
    [SerializeField] private LayerMask hitMask = ~0;

    [Header("UI")]
    [SerializeField] private Text scoreText;

    private Vector3 velocity;
    private float cameraPitch;
    private float nextShotTime;
    private int score;
    private readonly List<EnemyController> enemies = new();

    void Awake()
    {
        if (!controller) controller = GetComponent<CharacterController>();
        if (!playerCamera) playerCamera = GetComponentInChildren<Camera>();
        if (!muzzleTransform) muzzleTransform = playerCamera.transform;

        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        enemies.AddRange(FindObjectsOfType<EnemyController>());
        foreach (var enemy in enemies)
        {
            enemy.SetTarget(transform);
        }

        UpdateScore(0);
    }

    void Update()
    {
        HandleLook();
        HandleMovement();
        HandleFire();
    }

    private void HandleMovement()
    {
        bool isGrounded = controller.isGrounded;
        if (isGrounded && velocity.y < 0f)
        {
            velocity.y = -2f;
        }

        float inputX = Input.GetAxis("Horizontal");
        float inputZ = Input.GetAxis("Vertical");
        Vector3 move = transform.right * inputX + transform.forward * inputZ;
        float speed = Input.GetKey(KeyCode.LeftShift) ? moveSpeed * sprintMultiplier : moveSpeed;
        controller.Move(move * speed * Time.deltaTime);

        if (Input.GetButtonDown("Jump") && isGrounded)
        {
            velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);
        }

        velocity.y += gravity * Time.deltaTime;
        controller.Move(velocity * Time.deltaTime);
    }

    private void HandleLook()
    {
        float mouseX = Input.GetAxis("Mouse X") * lookSpeed;
        float mouseY = Input.GetAxis("Mouse Y") * lookSpeed;

        cameraPitch -= mouseY;
        cameraPitch = Mathf.Clamp(cameraPitch, -80f, 80f);
        playerCamera.transform.localRotation = Quaternion.Euler(cameraPitch, 0f, 0f);

        transform.Rotate(Vector3.up * mouseX);
    }

    private void HandleFire()
    {
        if (!Input.GetButton("Fire1")) return;
        if (Time.time < nextShotTime) return;
        nextShotTime = Time.time + fireRate;

        Ray ray = new Ray(playerCamera.transform.position, playerCamera.transform.forward);
        if (Physics.Raycast(ray, out RaycastHit hit, shootRange, hitMask, QueryTriggerInteraction.Ignore))
        {
            if (hit.rigidbody != null)
            {
                hit.rigidbody.AddForceAtPosition(playerCamera.transform.forward * 15f, hit.point, ForceMode.Impulse);
            }

            EnemyController enemy = hit.collider.GetComponentInParent<EnemyController>();
            if (enemy != null)
            {
                bool killed = enemy.TakeDamage(damagePerShot);
                if (killed)
                {
                    RegisterEnemyKill();
                }
            }
        }
    }

    public void RegisterEnemyKill()
    {
        score += 1;
        UpdateScore(score);
    }

    private void UpdateScore(int value)
    {
        score = value;
        if (scoreText != null)
        {
            scoreText.text = $"Score: {score}";
        }
    }
}

public class EnemyController : MonoBehaviour
{
    [SerializeField] private int health = 100;
    [SerializeField] private float chaseRange = 25f;
    [SerializeField] private float attackRange = 2f;
    [SerializeField] private int attackDamage = 10;
    [SerializeField] private float attackCooldown = 1.5f;

    private NavMeshAgent agent;
    private Transform target;
    private float nextAttackTime;

    void Awake()
    {
        agent = GetComponent<NavMeshAgent>();
    }

    void Update()
    {
        if (target == null || agent == null) return;

        float distance = Vector3.Distance(transform.position, target.position);
        if (distance <= chaseRange)
        {
            agent.SetDestination(target.position);
        }

        if (distance <= attackRange && Time.time >= nextAttackTime)
        {
            nextAttackTime = Time.time + attackCooldown;
            // Placeholder for player damage hook.
        }
    }

    public void SetTarget(Transform player)
    {
        target = player;
    }

    public bool TakeDamage(int amount)
    {
        health -= amount;
        if (health <= 0)
        {
            Die();
            return true;
        }
        return false;
    }

    private void Die()
    {
        if (agent != null)
        {
            agent.isStopped = true;
            agent.ResetPath();
        }
        gameObject.SetActive(false);
    }
}
